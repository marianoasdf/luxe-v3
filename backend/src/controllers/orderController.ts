// Normaliza los totales de una orden
function normalizeOrderTotals(order: any) {
  const items = Array.isArray(order.items)
    ? order.items
    : typeof order.items === 'string'
      ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
      : [];
  const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.unit_price || 0) * Number(it.quantity || 1), 0);
  const shipping_cost = order.shipping_cost != null ? Number(order.shipping_cost) : 0;
  const original_amount = order.original_amount != null ? Number(order.original_amount) : subtotal + shipping_cost;
  const discount_applied = order.discount_applied != null ? Number(order.discount_applied) : 0;
  const total_amount = order.total_amount != null ? Number(order.total_amount) : (original_amount - discount_applied);
  return {
    ...order,
    subtotal,
    shipping_cost,
    original_amount,
    discount_applied,
    total_amount,
  };
}
import type { Response } from 'express';
import pool from '../config/db';
import type { AuthRequest } from '../types';
import { sendOrderStatusUpdateEmail, sendOrderConfirmationEmail } from '../services/email';
import { calculateShippingQuote } from '../services/shippingService';
import { getTransferDiscountPercent } from '../services/settingsService';

// Actualizar estado de una orden (solo admin)
export async function adminUpdateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (!orderId) {
      res.status(400).json({ error: 'ID de orden invalido' });
      return;
    }

    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'failed', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Estado invalido. Estados permitidos: pending, paid, failed, cancelled' });
      return;
    }

    // Obtener la orden actual
    const { rows } = await pool.query(
      `SELECT id, status, buyer_email, buyer_name, total_amount, currency, items
       FROM orders WHERE id=$1`,
      [orderId]
    );

    const order = rows[0];
    if (!order) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }

    // Si el estado no cambia, no hacer nada
    if (order.status === status) {
      res.json({ success: true, message: 'El estado ya es el mismo', order: order });
      return;
    }

    // Actualizar el estado
    await pool.query(
      `UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2`,
      [status, orderId]
    );

    // Enviar email de notificacion al cliente
    try {
      await sendOrderStatusUpdateEmail({
        to: order.buyer_email,
        orderId: order.id,
        buyerName: order.buyer_name,
        status: status,
        total: order.total_amount,
        currency: order.currency,
      });
    } catch (emailError) {
      console.error('Error enviando email de actualizacion:', emailError);
      // No fallamos la peticion si el email falla
    }

    res.json({ 
      success: true, 
      message: 'Estado actualizado correctamente',
      order: {
        ...order,
        status: status
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('adminUpdateOrderStatus error:', msg);
    res.status(500).json({ error: 'Error actualizando el estado de la orden' });
  }
}

// Crear orden para pago por transferencia
export async function createTransferOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      buyer_name,
      buyer_email,
      buyer_address,
      buyer_phone,
      items,
      shipping_method,
      currency = 'ARS'
    } = req.body;

    // Validaciones basicas
    if (!buyer_name || !buyer_email || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Datos incompletos para crear la orden' });
      return;
    }

    // Calcular subtotal sumando los precios de los ítems
    const subtotal_calc = Array.isArray(items)
      ? items.reduce((acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 1), 0)
      : 0;

    let buyerAddressObj: any = {};
    try {
      buyerAddressObj = typeof buyer_address === 'string' ? JSON.parse(buyer_address) : { ...buyer_address };
    } catch { buyerAddressObj = {}; }
    if (buyer_phone && !buyerAddressObj.phone) buyerAddressObj.phone = buyer_phone;

    let shippingQuote;
    try {
      shippingQuote = await calculateShippingQuote({
        shipping: {
          method: String(shipping_method || 'retiro_local'),
          city: String(buyerAddressObj?.city ?? ''),
          province: String(buyerAddressObj?.province ?? ''),
          postalCode: String(buyerAddressObj?.zip ?? buyerAddressObj?.postalCode ?? ''),
          addressLine: String(buyerAddressObj?.street ?? buyerAddressObj?.addressLine ?? ''),
          reference: '',
          provider: '',
          cost: 0,
        },
        items,
        subtotal: subtotal_calc,
      });
    } catch (quoteError) {
      const quoteMsg = quoteError instanceof Error ? quoteError.message : 'No se pudo calcular el envio';
      res.status(400).json({ error: quoteMsg });
      return;
    }

    const shipping = Number(shippingQuote.cost || 0);
    const originalTotal = subtotal_calc + shipping;
    const discountPercent = await getTransferDiscountPercent();
    const finalTotal = Math.round(originalTotal * (1 - discountPercent / 100) * 100) / 100;
    const discount = Math.round((originalTotal - finalTotal) * 100) / 100;

    // Crear la orden en estado pending
    const { rows } = await pool.query(
      `INSERT INTO orders (
        status, buyer_name, buyer_email, buyer_address, buyer_phone,
        total_amount, items, shipping_method, shipping_cost, currency,
        mp_payment_status, original_amount, discount_applied
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        'pending',
        buyer_name,
        buyer_email,
        JSON.stringify(buyerAddressObj),
        buyer_phone,
        finalTotal, // total_amount: total FINAL (con descuento aplicado)
        JSON.stringify(items),
        shippingQuote.method,
        shipping,
        currency,
        'transfer',
        originalTotal, // original_amount: total SIN descuento
        discount // descuento aplicado
      ]
    );

    const orderId = rows[0].id;

    // Enviar email con instrucciones de transferencia
    try {
      await sendOrderConfirmationEmail({
        to: buyer_email,
        orderId: orderId,
        buyerName: buyer_name,
        amount: finalTotal,
        currency: currency,
        items,
        shipping_cost: shipping,
        discount: discount,
        originalTotal: originalTotal,
      });
    } catch (emailError) {
      console.error('Error enviando email de transferencia:', emailError);
    }

    res.json({
      success: true,
      orderId: orderId,
      status: 'pending',
      total: finalTotal,
      originalTotal: originalTotal,
      discount: discount,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('createTransferOrder error:', msg);
    res.status(500).json({ error: 'Error creando la orden de transferencia' });
  }
}

// Obtener detalles de orden para mostrar instrucciones de transferencia
export async function getTransferOrderDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (!orderId) {
      res.status(400).json({ error: 'ID de orden invalido' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, status, buyer_name, buyer_email, total_amount, currency,
              items, mp_payment_status, original_amount, discount_applied, created_at
       FROM orders WHERE id=$1 AND mp_payment_status='transfer'`,
      [orderId]
    );

    const order = rows[0];
    if (!order) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }

    // Calcular fecha de vencimiento (72 horas desde creacion)
    const createdAt = new Date(order.created_at);
    const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000);

    res.json({
      order: {
        ...normalizeOrderTotals(order),
        expiresAt: expiresAt.toISOString(),
        isExpired: new Date() > expiresAt,
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('getTransferOrderDetails error:', msg);
    res.status(500).json({ error: 'Error obteniendo detalles de la orden' });
  }
}
