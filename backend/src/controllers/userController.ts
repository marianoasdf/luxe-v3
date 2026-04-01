import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import pool from '../config/db';
import {
  createUser,
  getUserById,
  createEmailVerificationToken,
} from '../models/User';
import { sendVerificationEmail } from '../services/email';
import { param } from '../types';
import type { AuthRequest, AddressRow } from '../types';

// ─── Address helpers ────────────────────────────────────────

async function ensureUserAddressesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_addresses (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      recipient_name TEXT,
      phone TEXT,
      address TEXT NOT NULL,
      street_address TEXT,
      city TEXT,
      province TEXT,
      postal_code TEXT,
      reference TEXT,
      source TEXT NOT NULL DEFAULT 'legacy_order',
      notes TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id)');
}

function buildAddressLine(payload: Record<string, unknown>): string {
  const parts = [payload.street_address, payload.city, payload.province, payload.postal_code]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  return String(payload.address ?? '').trim();
}

interface NormalizedAddress {
  recipient_name: string | null;
  phone: string | null;
  address: string;
  street_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  reference: string | null;
  notes: string | null;
  is_primary: boolean;
}

function normalizeAddressPayload(body: Record<string, unknown>): NormalizedAddress {
  const streetAddress = String(body.street_address ?? '').trim() || null;
  const city = String(body.city ?? '').trim() || null;
  const province = String(body.province ?? '').trim() || null;
  const postalCode = String(body.postal_code ?? '').trim() || null;
  const reference = String(body.reference ?? body.notes ?? '').trim() || null;
  const legacyAddress = String(body.address ?? '').trim() || null;

  const address = buildAddressLine({
    street_address: streetAddress,
    city,
    province,
    postal_code: postalCode,
    address: legacyAddress,
  });

  return {
    recipient_name: String(body.recipient_name ?? body.buyer_name ?? '').trim() || null,
    phone: String(body.phone ?? body.buyer_phone ?? '').trim() || null,
    address,
    street_address: streetAddress,
    city,
    province,
    postal_code: postalCode,
    reference,
    notes: reference,
    is_primary: body.is_primary === true,
  };
}

async function getSavedAddresses(userId: number): Promise<AddressRow[]> {
  await ensureUserAddressesTable();
  const { rows } = await pool.query(
    `SELECT id, recipient_name, phone, address, street_address, city, province, postal_code, reference, source, notes, is_primary, created_at, updated_at
     FROM user_addresses
     WHERE user_id = $1
     ORDER BY is_primary DESC, updated_at DESC, id DESC`,
    [userId],
  );
  return rows;
}

interface OrderForSeed {
  buyer_name?: string;
  buyer_phone?: string;
  buyer_address?: string;
}

async function seedAddressesFromOrders(
  userId: number,
  fallbackName: string | null,
  orders: OrderForSeed[],
): Promise<AddressRow[]> {
  await ensureUserAddressesTable();
  const existing = await getSavedAddresses(userId);
  if (existing.length || !orders.length) return existing;

  const deduped: Array<{
    recipient_name: string | null;
    phone: string | null;
    address: string;
    is_primary: boolean;
  }> = [];
  const seen = new Set<string>();

  for (const order of orders) {
    const address = String(order.buyer_address ?? '').trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      recipient_name: order.buyer_name ?? fallbackName ?? null,
      phone: order.buyer_phone ?? null,
      address,
      is_primary: deduped.length === 0,
    });
  }

  for (const addr of deduped) {
    await pool.query(
      `INSERT INTO user_addresses (user_id, recipient_name, phone, address, street_address, source, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, addr.recipient_name, addr.phone, addr.address, addr.address, 'legacy_order', addr.is_primary],
    );
  }

  return getSavedAddresses(userId);
}

// ─── Controllers ────────────────────────────────────────────

export async function registerUser(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const nombre = String(req.body.nombre ?? '').trim();
  const email = String(req.body.email ?? '').trim();
  const password = String(req.body.password ?? '');

  if (!nombre || !email || !password) {
    res.status(400).json({ error: 'Todos los campos son obligatorios' });
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = await createUser(nombre, email, hashed);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createEmailVerificationToken(user.id, token, expiresAt);

    try {
      await sendVerificationEmail({ to: email, token });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[email] Falló envío de verificación', msg);
    }

    res.status(201).json({
      message: 'Usuario registrado. Revisa tu email para activar la cuenta.',
      pending_verification: true,
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'El email ya está registrado' });
    } else {
      res.status(500).json({ error: 'Error al registrar usuario' });
    }
  }
}

export async function getMyDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = Number(req.user?.id);
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const safeUser = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      email_verified: !!user.email_verified,
      created_at: user.created_at ?? null,
    };

    const { rows: orders } = await pool.query(
      `SELECT id, status, total_amount, currency, items, buyer_name, buyer_email,
              buyer_address, buyer_phone, shipping_method, shipping_cost, tracking_code,
              mp_payment_status, created_at, updated_at
       FROM orders
       WHERE LOWER(COALESCE(buyer_email, '')) = LOWER($1)
       ORDER BY created_at DESC LIMIT 100`,
      [user.email],
    );

    const addresses = await seedAddressesFromOrders(userId, safeUser.nombre, orders);
    res.json({ user: safeUser, addresses, purchases: orders });
  } catch (err) {
    console.error('getMyDashboard error', err);
    res.status(500).json({ error: 'Error obteniendo panel de usuario' });
  }
}

export async function createMyAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = Number(req.user?.id);
    if (!userId) { res.status(401).json({ error: 'No autenticado' }); return; }

    const payload = normalizeAddressPayload(req.body);
    if (!payload.address) { res.status(400).json({ error: 'La dirección es obligatoria' }); return; }

    await ensureUserAddressesTable();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const { rows: current } = await client.query(
        'SELECT COUNT(*)::int AS count FROM user_addresses WHERE user_id = $1',
        [userId],
      );
      const shouldBePrimary = payload.is_primary || current[0].count === 0;
      if (shouldBePrimary) {
        await client.query(
          'UPDATE user_addresses SET is_primary = false, updated_at = NOW() WHERE user_id = $1',
          [userId],
        );
      }
      const { rows } = await client.query(
        `INSERT INTO user_addresses (user_id, recipient_name, phone, address, street_address, city, province, postal_code, reference, source, notes, is_primary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [userId, payload.recipient_name, payload.phone, payload.address, payload.street_address, payload.city, payload.province, payload.postal_code, payload.reference, 'profile', payload.notes, shouldBePrimary],
      );
      await client.query('COMMIT');
      res.status(201).json({ address: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('createMyAddress error', err);
    res.status(500).json({ error: 'Error creando dirección' });
  }
}

export async function updateMyAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = Number(req.user?.id);
    const addressId = parseInt(param(req, 'id'), 10);
    if (!userId) { res.status(401).json({ error: 'No autenticado' }); return; }
    if (!addressId) { res.status(400).json({ error: 'Dirección inválida' }); return; }

    const payload = normalizeAddressPayload(req.body);
    if (!payload.address) { res.status(400).json({ error: 'La dirección es obligatoria' }); return; }

    await ensureUserAddressesTable();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const { rows: existingRows } = await client.query(
        'SELECT id, is_primary FROM user_addresses WHERE id = $1 AND user_id = $2 LIMIT 1',
        [addressId, userId],
      );
      if (!existingRows[0]) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Dirección no encontrada' });
        return;
      }
      const shouldBePrimary = payload.is_primary || existingRows[0].is_primary;
      if (shouldBePrimary) {
        await client.query('UPDATE user_addresses SET is_primary = false, updated_at = NOW() WHERE user_id = $1', [userId]);
      }
      const { rows } = await client.query(
        `UPDATE user_addresses SET recipient_name=$1, phone=$2, address=$3, street_address=$4, city=$5, province=$6, postal_code=$7, reference=$8, notes=$9, is_primary=$10, updated_at=NOW()
         WHERE id=$11 AND user_id=$12 RETURNING *`,
        [payload.recipient_name, payload.phone, payload.address, payload.street_address, payload.city, payload.province, payload.postal_code, payload.reference, payload.notes, shouldBePrimary, addressId, userId],
      );
      await client.query('COMMIT');
      res.json({ address: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('updateMyAddress error', err);
    res.status(500).json({ error: 'Error actualizando dirección' });
  }
}

export async function setPrimaryMyAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = Number(req.user?.id);
    const addressId = parseInt(param(req, 'id'), 10);
    if (!userId) { res.status(401).json({ error: 'No autenticado' }); return; }
    if (!addressId) { res.status(400).json({ error: 'Dirección inválida' }); return; }

    await ensureUserAddressesTable();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        'SELECT 1 FROM user_addresses WHERE id = $1 AND user_id = $2',
        [addressId, userId],
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Dirección no encontrada' });
        return;
      }
      await client.query('UPDATE user_addresses SET is_primary = false, updated_at = NOW() WHERE user_id = $1', [userId]);
      const { rows } = await client.query(
        'UPDATE user_addresses SET is_primary = true, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
        [addressId, userId],
      );
      await client.query('COMMIT');
      res.json({ address: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('setPrimaryMyAddress error', err);
    res.status(500).json({ error: 'Error marcando dirección principal' });
  }
}
