// Centraliza la lógica de precios para el checkout
// Todas las funciones son puras y reutilizables


// Tipo base para ítems de carrito, robusto y estricto, con campos opcionales usados en el flujo
export interface CartItemBase {
  id: number;
  name: string;
  price: number;
  cantidad: number;
  variant_id?: string | number | null;
  talle?: string | null;
  color?: string | null;
  img?: string;
}

// Tipo de entrada aceptado para normalización (solo Partial<CartItemBase>)
export type CartItemInput = Partial<CartItemBase>;

// Helper para asegurar número válido (acepta strings numéricos)
function safeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return !isNaN(n) ? n : fallback;
  }
  return fallback;
}

// Normaliza cualquier entrada a CartItemBase (única puerta de entrada, preservando campos opcionales)
export function normalizarCartItem(item: CartItemInput): CartItemBase {
  return {
    id: safeNumber(item.id, 0),
    name: typeof item.name === 'string' ? item.name : '',
    price: safeNumber(item.price, 0),
    cantidad: safeNumber(item.cantidad, 0),
    variant_id: item.variant_id ?? null,
    talle: typeof item.talle === 'string' ? item.talle : (item.talle === null ? null : ''),
    color: typeof item.color === 'string' ? item.color : (item.color === null ? null : ''),
    img: typeof item.img === 'string' ? item.img : '',
  };
}

export function calcularSubtotal(carrito: CartItemBase[]): number {
  return carrito.reduce((acc, item) => acc + item.price * item.cantidad, 0);
}

export function calcularEnvio(shippingCost: number): number {
  return safeNumber(shippingCost, 0);
}

export const TRANSFER_DISCOUNT_RATE = 0.1;
export const TRANSFER_DISCOUNT_PERCENT = Math.round(TRANSFER_DISCOUNT_RATE * 100);

export function calcularDescuentoTransferencia(totalOriginal: number): number {
  return Math.round(safeNumber(totalOriginal, 0) * TRANSFER_DISCOUNT_RATE);
}

export function calcularTotalOriginal(subtotal: number, shippingCost: number): number {
  return safeNumber(subtotal, 0) + safeNumber(shippingCost, 0);
}

export function calcularTotalConDescuento(totalOriginal: number): number {
  return Math.round(safeNumber(totalOriginal, 0) * (1 - TRANSFER_DISCOUNT_RATE));
}

export function calcularTotalSinDescuento(totalOriginal: number): number {
  return safeNumber(totalOriginal, 0);
}
