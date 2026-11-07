// Utilidades para procesamiento de pagos

import { authFetch } from './api';

export interface CartItem {
  id: number;
  name: string;
  variant_id?: number;
  talle?: string;
  color?: string;
  cantidad: number;
  price: number;
}

export interface TransferOrderRequest {
  buyer_name: string;
  buyer_email: string;
  buyer_address: Record<string, string>;
  buyer_phone: string;
  items: {
    product_id: number;
    title: string;
    variant_id: number | null;
    talle: string;
    color: string;
    quantity: number;
    unit_price: number;
  }[];
  subtotal: number;
  shipping_cost: number;
  shipping_method: string;
  currency?: string;
}

export interface TransferOrderResponse {
  success: boolean;
  orderId: number;
  status: string;
  total: number;
  originalTotal: number;
  discount: number;
  expiresAt: string;
}

export async function createTransferOrder(
  orderData: TransferOrderRequest
): Promise<TransferOrderResponse> {
  const response = await authFetch('/api/payments/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Error creando la orden de transferencia');
  }

  return data;
}
