import type { Response } from 'express';
import pool from '../config/db';
import { calculateShippingQuote } from '../services/shippingService';
import { param } from '../types';
import type { AuthRequest } from '../types';

export async function quoteShipping(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    const shipping = body.shipping ?? body;
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = Number(body.subtotal ?? body.total ?? 0);

    const quote = await calculateShippingQuote({ shipping, items, subtotal });
    res.json({ shipping: quote });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo calcular el envio';
    console.error('quoteShipping error', msg);
    res.status(400).json({ error: msg });
  }
}

export async function adminListOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const { rows } = await pool.query(
      `SELECT id, status, buyer_name, buyer_email, buyer_address, buyer_phone, total_amount, currency,
              items, shipping_method, shipping_cost, tracking_code, mp_payment_status,
              original_amount, discount_applied, created_at, updated_at
       FROM orders ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    res.json({ orders: rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('adminListOrders error', msg);
    res.status(500).json({ error: 'Error listando ordenes' });
  }
}

export async function adminGetOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(param(req, 'id'), 10);
    if (!id) { res.status(400).json({ error: 'id invalido' }); return; }

    const { rows } = await pool.query(
      `SELECT id, status, buyer_name, buyer_email, buyer_address, buyer_phone, total_amount, currency,
              items, shipping_method, shipping_cost, tracking_code, mp_payment_status,
              original_amount, discount_applied, created_at, updated_at
       FROM orders WHERE id=$1`,
      [id],
    );

    const order = rows[0];
    if (!order) { res.status(404).json({ error: 'Orden no encontrada' }); return; }
    res.json({ order });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('adminGetOrder error', msg);
    res.status(500).json({ error: 'Error obteniendo la orden' });
  }
}

