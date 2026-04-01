import type { Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import pool from '../config/db';
import {
  calculateShippingQuote,
  normalizeShippingInput,
  buildAddressText,
} from '../services/shippingService';
import { param } from '../types';
import type { AuthRequest, ValidatedItem } from '../types';

// ─── Helpers ────────────────────────────────────────────────

function normalizeText(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

interface HttpError extends Error {
  status: number;
  detail?: unknown;
}

function createHttpError(status: number, message: string, detail?: unknown): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  err.detail = detail;
  return err;
}

function buildMercadoPagoItems(
  validItems: ValidatedItem[],
  shippingQuote: { cost?: number },
) {
  const items = validItems.map((v) => ({
    id: String(v.product_id),
    title: v.name,
    quantity: v.quantity,
    unit_price: v.unit_price,
    currency_id: 'ARS',
  }));

  const shippingCost = Number(shippingQuote.cost ?? 0);
  if (shippingCost > 0) {
    items.push({
      id: 'shipping',
      title: 'Envio Correo Argentino',
      quantity: 1,
      unit_price: shippingCost,
      currency_id: 'ARS',
    });
  }

  return items;
}

async function buildValidatedItems(
  itemsInput: Array<Record<string, unknown>>,
): Promise<{ validItems: ValidatedItem[]; total: number }> {
  const validItems: ValidatedItem[] = [];
  let total = 0;

  for (const it of itemsInput) {
    const productId = parseInt(String(it.product_id), 10);
    const qty = parseInt(String(it.quantity ?? it.cantidad ?? 1), 10);
    if (!productId || qty <= 0) continue;

    const { rows: productRows } = await pool.query(
      'SELECT id, name, description, price, currency, attributes FROM products WHERE id=$1 AND deleted_at IS NULL',
      [productId],
    );
    const p = productRows[0];
    if (!p) continue;

    const talle = normalizeText(it.talle);
    const color = normalizeText(it.color);
    const variantId = parseInt(String(it.variant_id ?? it.variantId ?? 0), 10) || null;
    let variant: Record<string, unknown> | null = null;

    if (variantId) {
      const { rows } = await pool.query(
        `SELECT id, option_values, price, stock FROM product_variants WHERE id = $1 AND product_id = $2 AND status = 'active' LIMIT 1`,
        [variantId, productId],
      );
      variant = rows[0] ?? null;
    } else if (talle || color) {
      const { rows } = await pool.query(
        `SELECT id, option_values, price, stock FROM product_variants
         WHERE product_id = $1 AND status = 'active'
           AND COALESCE(LOWER(option_values->>'talle'), '') = LOWER($2)
           AND COALESCE(LOWER(option_values->>'color'), '') = LOWER($3)
         ORDER BY id LIMIT 1`,
        [productId, talle, color],
      );
      variant = rows[0] ?? null;
    }

    if ((variantId || talle || color) && !variant) {
      throw createHttpError(409, 'Variante inválida o no disponible', {
        product_id: productId,
        variant_id: variantId,
        talle,
        color,
      });
    }

    if (variant) {
      const stock = Number(variant.stock ?? 0);
      if (qty > stock) {
        const ov = (variant.option_values as Record<string, string>) ?? {};
        throw createHttpError(409, 'Stock insuficiente para una variante', {
          product_id: productId,
          variant_id: variant.id,
          talle: ov.talle ?? talle,
          color: ov.color ?? color,
          requested: qty,
          available: stock,
        });
      }
    }

    const unitPrice = Number(
      variant && variant.price != null ? variant.price : p.price,
    );
    const subtotal = unitPrice * qty;
    total += subtotal;

    let categoryId: string | undefined;
    try {
      const attrs = (p.attributes ?? {}) as Record<string, unknown>;
      const tipo = attrs.tipo ?? attrs.category ?? attrs.categoria;
      if (typeof tipo === 'string')
        categoryId = tipo.toLowerCase().replace(/\s+/g, '_');
    } catch { /* noop */ }

    const ov = (variant?.option_values as Record<string, string>) ?? {};
    validItems.push({
      product_id: p.id,
      variant_id: variant ? (variant.id as number) : null,
      talle: ov.talle ?? talle ?? undefined,
      color: ov.color ?? color ?? undefined,
      name: p.name,
      description: p.description ?? undefined,
      category_id: categoryId,
      unit_price: unitPrice,
      quantity: qty,
      subtotal,
    });
  }

  if (!validItems.length) {
    throw createHttpError(400, 'items inválidos');
  }

  return { validItems, total };
}

// ─── Controllers ────────────────────────────────────────────

export async function createPreference(req: AuthRequest, res: Response): Promise<void> {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN faltante');

    const body = req.body ?? {};
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    if (!itemsInput.length) { res.status(400).json({ error: 'items requerido' }); return; }

    const { validItems, total } = await buildValidatedItems(itemsInput);

    const buyer = (body.buyer ?? {}) as Record<string, unknown>;
    const shippingInput = normalizeShippingInput((body.shipping ?? {}) as Record<string, unknown>);
    const shippingQuote = await calculateShippingQuote({
      shipping: shippingInput,
      items: validItems as unknown as Array<Record<string, unknown>>,
      subtotal: total,
    });
    const orderTotal = total + Number(shippingQuote.cost ?? 0);
    const buyerAddress = buildAddressText({ buyer, shipping: shippingQuote.shipping });

    const insertOrder = await pool.query(
      `INSERT INTO orders (status, buyer_name, buyer_email, buyer_address, buyer_phone, total_amount, currency, items, shipping_method, shipping_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING id`,
      [
        'pending',
        buyer.name ?? null,
        buyer.email ?? null,
        buyerAddress ?? null,
        buyer.phone ?? null,
        orderTotal,
        'ARS',
        JSON.stringify(validItems),
        shippingQuote.method ?? null,
        Number(shippingQuote.cost ?? 0),
      ],
    );
    const orderId = insertOrder.rows[0].id;

    const preference = {
      items: buildMercadoPagoItems(validItems, shippingQuote),
      payer: buyer.email ? { email: buyer.email } : undefined,
      external_reference: String(orderId),
      notification_url: `${process.env.API_BASE_URL ?? 'https://api.luxeargentina.com'}/api/webhooks/mercadopago`,
    };

    const response = await axios.post(
      'https://api.mercadopago.com/checkout/preferences',
      preference,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const prefId = response.data.id;
    const initPoint = response.data.init_point;
    const sandboxInitPoint = response.data.sandbox_init_point;

    await pool.query('UPDATE orders SET mp_preference_id=$1, updated_at=NOW() WHERE id=$2', [prefId, orderId]);

    res.status(201).json({
      orderId,
      preferenceId: prefId,
      initPoint,
      sandboxInitPoint,
      shipping: {
        method: shippingQuote.method,
        cost: Number(shippingQuote.cost ?? 0),
        zone: shippingQuote.zone,
        source: shippingQuote.source,
      },
      total: orderTotal,
    });
  } catch (err) {
    const httpErr = err as HttpError;
    if (httpErr.status) {
      res.status(httpErr.status).json({ error: httpErr.message, detail: httpErr.detail });
      return;
    }
    const axiosData = axios.isAxiosError(err) ? err.response?.data : undefined;
    console.error('createPreference error', axiosData ?? (err instanceof Error ? err.message : err));
    res.status(500).json({ error: 'Error creando preferencia', details: axiosData });
  }
}

export async function createPayment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN faltante');

    const body = req.body ?? {};
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    const buyer = (body.buyer ?? {}) as Record<string, unknown>;

    let fd: Record<string, unknown> = {};
    if (body.formData) {
      fd = body.formData.formData
        ? (body.formData.formData as Record<string, unknown>)
        : (body.formData as Record<string, unknown>);
    }
    if (!fd.token && body.payment) fd = body.payment as Record<string, unknown>;

    if (!itemsInput.length) { res.status(400).json({ error: 'items requerido' }); return; }

    const isWalletPurchase =
      fd.paymentType === 'wallet_purchase' ||
      fd.selectedPaymentMethod === 'wallet_purchase';

    const { validItems, total } = await buildValidatedItems(itemsInput);
    const shippingInput = normalizeShippingInput((body.shipping ?? {}) as Record<string, unknown>);
    const shippingQuote = await calculateShippingQuote({
      shipping: shippingInput,
      items: validItems as unknown as Array<Record<string, unknown>>,
      subtotal: total,
    });
    const orderTotal = total + Number(shippingQuote.cost ?? 0);
    const buyerAddress = buildAddressText({ buyer, shipping: shippingQuote.shipping });

    const insertOrder = await pool.query(
      `INSERT INTO orders (status, buyer_name, buyer_email, buyer_address, buyer_phone, total_amount, currency, items, shipping_method, shipping_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING id`,
      [
        'pending',
        buyer.name ?? null,
        buyer.email ?? null,
        buyerAddress ?? null,
        buyer.phone ?? null,
        orderTotal,
        'ARS',
        JSON.stringify(validItems),
        shippingQuote.method ?? null,
        Number(shippingQuote.cost ?? 0),
      ],
    );
    const orderId = insertOrder.rows[0].id;
    const apiBaseUrl = process.env.API_BASE_URL ?? 'https://api.luxeargentina.com';

    // Wallet purchase -> preference redirect
    if (isWalletPurchase || !fd.token) {
      const preference = {
        items: buildMercadoPagoItems(validItems, shippingQuote),
        payer: buyer.email ? { email: buyer.email } : undefined,
        external_reference: String(orderId),
        notification_url: `${apiBaseUrl}/api/webhooks/mercadopago`,
      };

      const prefRes = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        preference,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const prefData = prefRes.data ?? {};
      await pool.query('UPDATE orders SET mp_preference_id=$1, updated_at=NOW() WHERE id=$2', [prefData.id, orderId]);

      res.status(201).json({
        orderId,
        preferenceId: prefData.id,
        initPoint: prefData.init_point,
        sandboxInitPoint: prefData.sandbox_init_point,
        message: 'Redirigiendo a Mercado Pago para completar el pago',
      });
      return;
    }

    if (!fd.token) {
      res.status(400).json({ error: 'Token requerido para tarjeta' });
      return;
    }

    const isLocalhost = apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1');
    const payer = fd.payer as Record<string, unknown> | undefined;

    const paymentPayload: Record<string, unknown> = {
      transaction_amount: Number(orderTotal),
      token: fd.token,
      description: `Orden #${orderId}`,
      installments: Number(fd.installments ?? 1),
      payment_method_id: fd.payment_method_id,
      issuer_id: fd.issuer_id,
      external_reference: String(orderId),
      payer: {
        email: buyer.email ?? payer?.email ?? undefined,
        first_name: buyer.first_name ?? undefined,
        last_name: buyer.last_name ?? undefined,
        identification: payer?.identification ?? undefined,
      },
      statement_descriptor: process.env.STATEMENT_DESCRIPTOR ?? 'Luxe Argentina',
    };

    if (!isLocalhost) {
      paymentPayload.notification_url = `${apiBaseUrl}/api/webhooks/mercadopago`;
    }

    if (typeof body.binary_mode === 'boolean') paymentPayload.binary_mode = body.binary_mode;
    if (typeof body.capture === 'boolean') paymentPayload.capture = body.capture;

    const mpItems = buildMercadoPagoItems(validItems, shippingQuote);
    paymentPayload.additional_info = {
      items: mpItems.map((v) => ({
        id: String(v.id),
        title: String(v.title),
        quantity: Number(v.quantity),
        unit_price: Number(v.unit_price),
      })),
    };

    const idempotencyKey = crypto.randomUUID();
    const mpRes = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
      },
    );

    const data = mpRes.data ?? {};
    const status = data.status as string;
    let newStatus = 'pending';
    if (status === 'approved') newStatus = 'paid';
    else if (status === 'rejected' || status === 'cancelled') newStatus = 'failed';

    await pool.query(
      'UPDATE orders SET status=$1, mp_payment_id=$2, mp_payment_status=$3, updated_at=NOW() WHERE id=$4',
      [newStatus, String(data.id ?? ''), status ?? null, orderId],
    );

    res.status(201).json({
      orderId,
      payment: { id: data.id, status, status_detail: data.status_detail },
    });
  } catch (err) {
    const httpErr = err as HttpError;
    if (httpErr.status) {
      res.status(httpErr.status).json({ error: httpErr.message, detail: httpErr.detail });
      return;
    }
    const details = axios.isAxiosError(err) ? err.response?.data : (err instanceof Error ? err.message : err);
    console.error('createPayment error', details);
    res.status(500).json({ error: 'Error creando pago', details });
  }
}

export async function webhookMercadoPago(req: AuthRequest, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const q = req.query as Record<string, string>;
    const body = req.body ?? {};
    const eventType = body.type ?? q.type ?? q.topic ?? 'unknown';

    if (eventType === 'ping') {
      res.status(200).json({ ignored: true, type: 'ping' });
      return;
    }

    const paymentId =
      q['data.id'] ?? body.data?.id ?? (q.topic === 'payment' ? q.id : undefined);

    if (eventType === 'merchant_order') {
      res.status(200).json({ ignored: true, type: 'merchant_order' });
      return;
    }

    if (eventType !== 'payment' || !paymentId) {
      res.status(200).json({ ignored: true, type: eventType, reason: 'invalid_event' });
      return;
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN faltante');

    const paymentRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const data = paymentRes.data;
    const status = data?.status as string;
    const externalRef = data?.external_reference as string;
    if (!externalRef) { res.status(400).json({ error: 'orden no referenciada' }); return; }

    const orderId = parseInt(externalRef, 10);
    if (!orderId) { res.status(400).json({ error: 'orderId inválido' }); return; }

    let newStatus = 'pending';
    if (status === 'approved') newStatus = 'paid';
    else if (status === 'rejected' || status === 'cancelled') newStatus = 'failed';

    await pool.query(
      'UPDATE orders SET status=$1, mp_payment_id=$2, mp_payment_status=$3, updated_at=NOW() WHERE id=$4',
      [newStatus, String(paymentId), status, orderId],
    );

    res.status(200).json({ ok: true, orderId, paymentId, status, mappedStatus: newStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('webhookMercadoPago error', msg);
    res.status(500).json({ error: 'Error webhook' });
  }
}

export async function getOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(param(req, 'id'), 10);
    if (!id) { res.status(400).json({ error: 'id inválido' }); return; }
    const { rows } = await pool.query(
      'SELECT id, status, buyer_name, buyer_email, buyer_address, buyer_phone, total_amount, currency, items, shipping_method, shipping_cost, tracking_code, mp_payment_status, created_at, updated_at FROM orders WHERE id=$1',
      [id],
    );
    const order = rows[0];
    if (!order) { res.status(404).json({ error: 'orden no encontrada' }); return; }
    res.json({ order });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('getOrder error', msg);
    res.status(500).json({ error: 'Error obteniendo orden' });
  }
}

export async function listOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const { rows } = await pool.query(
      'SELECT id, status, mp_payment_id, mp_payment_status, total_amount, buyer_name, buyer_email, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    res.json({ orders: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('listOrders error', msg);
    res.status(500).json({ error: 'Error listando órdenes' });
  }
}
