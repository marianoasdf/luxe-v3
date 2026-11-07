import type { ShippingInput, ShippingQuote, FixedRate } from '../types';

// ─── Constants ──────────────────────────────────────────────

// PAQ.AR Clásico a domicilio, cotizado en MiCorreo el 27/09/2026
// desde Concordia (3200), paquete 30x25x7 cm, 0,450 kg.
const FIXED_RATES: FixedRate[] = [
  { zone: 'AMBA', min: 1000, max: 1899, cost: 9648, etaDays: '2-5' },
  { zone: 'Centro', min: 1900, max: 2999, cost: 9648, etaDays: '2-5' },
  { zone: 'Litoral', min: 3000, max: 3999, cost: 9648, etaDays: '2-5' },
  { zone: 'NOA', min: 4000, max: 4999, cost: 10509, etaDays: '2-5' },
  { zone: 'Cuyo', min: 5000, max: 5999, cost: 9648, etaDays: '2-5' },
  { zone: 'Pampeana', min: 6000, max: 6999, cost: 10509, etaDays: '2-5' },
  { zone: 'Sur', min: 7000, max: 7999, cost: 9648, etaDays: '2-5' },
  { zone: 'Patagonia', min: 8000, max: 9999, cost: 10586, etaDays: '2-5' },
];

// ─── Helpers ────────────────────────────────────────────────

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizePostalCode(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return digits.slice(0, 4);
}

export function normalizeShippingInput(
  rawShipping: Record<string, unknown> = {},
): ShippingInput {
  const method = String(rawShipping.method ?? 'retiro_local').toLowerCase();
  const provider =
    method === 'correo_argentino' || method === 'concordia_gratis'
      ? method
      : 'retiro_local';
  return {
    method,
    provider,
    postalCode: normalizePostalCode(rawShipping.postalCode ?? rawShipping.cp),
    province: String(rawShipping.province ?? '').trim(),
    city: String(rawShipping.city ?? '').trim(),
    addressLine: String(rawShipping.addressLine ?? rawShipping.address ?? '').trim(),
    reference: String(rawShipping.reference ?? '').trim(),
    cost: toNumber(rawShipping.cost, 0),
  };
}

function inferZoneByPostalCode(
  postalCode: string,
): { zone: string; cost: number; etaDays: string } {
  const cp = toNumber(postalCode, 0);
  const found = FIXED_RATES.find((rate) => cp >= rate.min && cp <= rate.max);
  return found ?? { zone: 'General', cost: 10586, etaDays: '2-5' };
}

// ─── Quote ──────────────────────────────────────────────────

interface QuoteParams {
  shipping: ShippingInput;
  items?: Array<Record<string, unknown>>;
  subtotal?: number;
}

function quoteFromFixedTable(params: QuoteParams): ShippingQuote {
  const { shipping } = params;
  if (!shipping.postalCode) {
    throw new Error('Codigo postal requerido para cotizar envio');
  }
  const zone = inferZoneByPostalCode(shipping.postalCode);
  return {
    provider: 'correo_argentino',
    method: 'correo_argentino',
    serviceCode: 'fixed_standard',
    serviceName: 'Correo Argentino Estandar',
    zone: zone.zone,
    cost: Number(zone.cost),
    etaDays: String(zone.etaDays),
    source: 'fixed_table',
  };
}

// Reglas de envío gratis
const FREE_SHIPPING_THRESHOLD = 150000; // $150.000
const FREE_SHIPPING_CITIES: string[] = [];

function isFreeShipping(params: QuoteParams, normalizedShipping: ShippingInput): boolean {
  const subtotal = Number(params.subtotal ?? 0);
  const city = normalizeText(normalizedShipping.city);
  
  // Envío gratis por monto
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return true;
  }
  
  // Envío gratis para ciudades específicas
  if (FREE_SHIPPING_CITIES.includes(city)) {
    return true;
  }
  
  return false;
}

export async function calculateShippingQuote(
  params: QuoteParams,
): Promise<ShippingQuote & { shipping: ShippingInput }> {
  const normalizedShipping = normalizeShippingInput(
    params.shipping as unknown as Record<string, unknown>,
  );

  if (normalizedShipping.method === 'retiro_local') {
    return {
      provider: 'retiro_local',
      method: 'retiro_local',
      serviceCode: 'pickup',
      serviceName: 'Retiro en tienda',
      zone: 'local',
      cost: 0,
      etaDays: '0',
      source: 'fixed_table',
      shipping: normalizedShipping,
    };
  }

  if (normalizedShipping.method === 'concordia_gratis') {
    const city = normalizeText(normalizedShipping.city);
    if (city !== 'concordia') {
      throw new Error('El envio gratis a Concordia solo aplica en Concordia');
    }
    return {
      provider: 'concordia_gratis',
      method: 'concordia_gratis',
      serviceCode: 'concordia_gratis',
      serviceName: 'Envio gratis a Concordia',
      zone: 'Concordia',
      cost: 0,
      etaDays: '1-2',
      source: 'concordia_gratis',
      shipping: { ...normalizedShipping, cost: 0 },
    };
  }

  // Verificar reglas de envío gratis
  if (isFreeShipping(params, normalizedShipping)) {
    const city = normalizeText(normalizedShipping.city);
    const isFreeByCity = FREE_SHIPPING_CITIES.includes(city);
    const subtotal = Number(params.subtotal ?? 0);
    const isFreeByAmount = subtotal >= FREE_SHIPPING_THRESHOLD;

    let serviceName = 'Envío gratis';
    if (isFreeByAmount && isFreeByCity) {
      serviceName = 'Envío gratis (Concordia + $150.000+)';
    } else if (isFreeByCity) {
      serviceName = 'Envío gratis a Concordia';
    } else if (isFreeByAmount) {
      serviceName = 'Envío gratis (+$150.000)';
    }

    // Calcular zona real por código postal
    const zoneData = inferZoneByPostalCode(normalizedShipping.postalCode);

    return {
      provider: 'correo_argentino',
      method: 'correo_argentino',
      serviceCode: 'free_shipping',
      serviceName,
      zone: zoneData.zone,
      cost: 0,
      etaDays: String(zoneData.etaDays),
      source: 'free_shipping_rule',
      shipping: normalizedShipping,
    };
  }

  const fixedQuote = quoteFromFixedTable({
    ...params,
    shipping: normalizedShipping,
  });
  return { ...fixedQuote, shipping: normalizedShipping };
}

// ─── Address builder ────────────────────────────────────────

interface BuyerShippingParams {
  buyer?: Record<string, unknown>;
  shipping?: ShippingInput;
}

export function buildAddressText({ buyer, shipping }: BuyerShippingParams): string {
  const fallback = String(buyer?.address ?? '').trim();
  if (!shipping || shipping.method === 'retiro_local')
    return fallback || 'Retiro en tienda';

  const parts = [
    shipping.addressLine,
    shipping.city,
    shipping.province,
    shipping.postalCode ? `CP ${shipping.postalCode}` : '',
  ].filter(Boolean);

  const address = parts.join(', ');
  return address || fallback || 'Sin direccion';
}
