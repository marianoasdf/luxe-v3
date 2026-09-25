import axios from 'axios';
import type { ShippingInput, ShippingQuote, FixedRate, OrderRow } from '../types';

// ─── Constants ──────────────────────────────────────────────

const FIXED_RATES: FixedRate[] = [
  { zone: 'AMBA', min: 1000, max: 1899, cost: 5500, etaDays: '1-3' },
  { zone: 'Centro', min: 1900, max: 2999, cost: 6900, etaDays: '2-4' },
  { zone: 'Litoral', min: 3000, max: 3999, cost: 7600, etaDays: '3-5' },
  { zone: 'NOA', min: 4000, max: 4999, cost: 8400, etaDays: '3-6' },
  { zone: 'Cuyo', min: 5000, max: 5999, cost: 7900, etaDays: '3-5' },
  { zone: 'Pampeana', min: 6000, max: 6999, cost: 7200, etaDays: '2-4' },
  { zone: 'Sur', min: 7000, max: 7999, cost: 9300, etaDays: '4-7' },
  { zone: 'Patagonia', min: 8000, max: 9999, cost: 10900, etaDays: '5-8' },
];

const PROVINCE_CODES: Record<string, string> = {
  salta: 'A',
  'provincia de buenos aires': 'B',
  'buenos aires': 'B',
  'ciudad autonoma de buenos aires': 'C',
  caba: 'C',
  'san luis': 'D',
  'entre rios': 'E',
  'la rioja': 'F',
  'santiago del estero': 'G',
  chaco: 'H',
  'san juan': 'J',
  catamarca: 'K',
  'la pampa': 'L',
  mendoza: 'M',
  misiones: 'N',
  formosa: 'P',
  neuquen: 'Q',
  'rio negro': 'R',
  'santa fe': 'S',
  tucuman: 'T',
  chubut: 'U',
  'tierra del fuego': 'V',
  corrientes: 'W',
  cordoba: 'X',
  jujuy: 'Y',
  'santa cruz': 'Z',
};

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
  return found ?? { zone: 'General', cost: 8500, etaDays: '3-6' };
}

function estimatePackageMetrics(items: Array<Record<string, unknown>> = []) {
  const normalized = Array.isArray(items) ? items : [];
  const quantity = normalized.reduce(
    (acc, item) =>
      acc +
      Math.max(
        1,
        parseInt(String(item.quantity ?? item.cantidad ?? 1), 10),
      ),
    0,
  );
  const weightGrams = Math.max(300, quantity * 450);
  return {
    quantity,
    weightGrams,
    lengthCm: 30,
    widthCm: 25,
    heightCm: Math.min(25, 6 + quantity),
  };
}

function normalizeItems(items: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toProvinceCode(value: unknown, fallback = 'C'): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (/^[A-Za-z]$/.test(raw)) return raw.toUpperCase();
  const normalized = normalizeText(raw);
  return PROVINCE_CODES[normalized] ?? fallback;
}

function parseAddress(rawAddress: unknown) {
  const addressText = String(rawAddress ?? '').trim();
  const cpMatch =
    addressText.match(/\bCP\s*(\d{4})\b/i) ?? addressText.match(/\b(\d{4})\b/);
  const zipCode = cpMatch ? cpMatch[1] : '';

  const cleaned = addressText.replace(/\bCP\s*\d{4}\b/gi, '').trim();
  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const streetChunk = parts[0] ?? '';
  const numberMatch = streetChunk.match(/(\d+[A-Za-z]?)\s*$/);
  const streetNumber = numberMatch ? numberMatch[1] : 'S/N';
  const streetName =
    streetChunk.replace(/\s*\d+[A-Za-z]?\s*$/, '').trim() || streetChunk || 'Sin calle';
  const cityName = parts[1] ?? String(process.env.CA_DEFAULT_CITY ?? 'CABA').trim();
  const stateRaw = parts[2] ?? String(process.env.CA_DEFAULT_STATE ?? 'CABA').trim();

  return {
    streetName,
    streetNumber,
    cityName,
    state: toProvinceCode(stateRaw),
    zipCode: normalizePostalCode(zipCode || process.env.CA_DEFAULT_ZIP_CODE || '1000'),
    floor: '',
    department: '',
  };
}

function formatSaleDate(value: unknown): string {
  const date = new Date((value as string) ?? Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  const utcMinus3 = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return utcMinus3.toISOString().replace('Z', '-03:00');
}

// ─── Correo Argentino API ───────────────────────────────────

interface CorreoApiConfig {
  apiBaseUrl: string;
  apiKey: string;
  agreement: string;
  sellerId: string;
  labelFormat: string;
  timeoutMs: number;
}

function getCorreoApiConfig(): CorreoApiConfig {
  return {
    apiBaseUrl: String(
      process.env.CA_API_BASE_URL ?? 'https://api.correoargentino.com.ar/paqar/v1',
    )
      .trim()
      .replace(/\/$/, ''),
    apiKey: String(process.env.CA_API_KEY ?? process.env.CA_API_TOKEN ?? '').trim(),
    agreement: String(process.env.CA_AGREEMENT ?? '').trim(),
    sellerId: String(process.env.CA_SELLER_ID ?? '').trim(),
    labelFormat: String(process.env.CA_LABEL_FORMAT ?? '10x15').trim(),
    timeoutMs: toNumber(process.env.CA_API_TIMEOUT_MS, 12000),
  };
}

function canUseCorreoApi(config: CorreoApiConfig): boolean {
  return !!(config.apiBaseUrl && config.apiKey && config.agreement);
}

function buildCorreoHeaders(config: CorreoApiConfig): Record<string, string> {
  return {
    Authorization: `Apikey ${config.apiKey}`,
    agreement: String(config.agreement),
    'Content-Type': 'application/json',
  };
}

function extractAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (data?.message) return String(data.message);
    if (typeof data?.error === 'string') return data.error;
  }
  if (error instanceof Error) return error.message;
  return 'Error de comunicacion con Correo Argentino';
}

async function validateCorreoCredentials(config: CorreoApiConfig): Promise<void> {
  if (!canUseCorreoApi(config)) {
    throw new Error(
      'CA_API_BASE_URL/CA_API_KEY/CA_AGREEMENT faltantes para modo api',
    );
  }

  const response = await axios.get(`${config.apiBaseUrl}/auth`, {
    headers: buildCorreoHeaders(config),
    timeout: config.timeoutMs,
    validateStatus: (status) => status < 500,
  });

  if (response.status !== 204 && response.status !== 200) {
    throw new Error(
      `Credenciales PAQ.AR invalidas (status ${response.status})`,
    );
  }
}

// ─── Quote ──────────────────────────────────────────────────

interface QuoteParams {
  shipping: ShippingInput;
  items?: Array<Record<string, unknown>>;
  subtotal?: number;
}

async function quoteFromCorreoArgentinoApi(
  params: QuoteParams,
): Promise<ShippingQuote> {
  const config = getCorreoApiConfig();
  await validateCorreoCredentials(config);

  const fixedQuote = quoteFromFixedTable(params);
  return {
    ...fixedQuote,
    source: 'fixed_table_verified_api',
    serviceName: 'Correo Argentino (tabla local validada)',
  };
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

  const mode = String(process.env.SHIPPING_MODE ?? 'fixed').toLowerCase();
  if (mode === 'api') {
    try {
      const apiQuote = await quoteFromCorreoArgentinoApi({
        ...params,
        shipping: normalizedShipping,
      });
      return { ...apiQuote, shipping: normalizedShipping };
    } catch (error) {
      const fallbackAllowed =
        String(process.env.SHIPPING_API_FALLBACK ?? 'true').toLowerCase() !==
        'false';
      if (!fallbackAllowed) throw error;
      const fixedQuote = quoteFromFixedTable({
        ...params,
        shipping: normalizedShipping,
      });
      return {
        ...fixedQuote,
        source: 'fixed_fallback',
        shipping: normalizedShipping,
      };
    }
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

// ─── Label generation ───────────────────────────────────────

function buildManualTrackingCode(orderId: number): string {
  const now = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `CA${String(orderId || 0).padStart(4, '0')}${now}${random}`;
}

function buildSenderData(config: CorreoApiConfig) {
  return {
    id: String(process.env.CA_SENDER_ID ?? config.agreement ?? ''),
    businessName: String(process.env.CA_SENDER_BUSINESS_NAME ?? 'Luxe').trim(),
    areaCodePhone: String(process.env.CA_SENDER_AREA_CODE_PHONE ?? '').trim(),
    phoneNumber: String(process.env.CA_SENDER_PHONE ?? '').trim(),
    areaCodeCellphone: String(process.env.CA_SENDER_AREA_CODE_CELLPHONE ?? '').trim(),
    cellphoneNumber: String(process.env.CA_SENDER_CELLPHONE ?? '').trim(),
    email: String(process.env.CA_SENDER_EMAIL ?? '').trim(),
    observation: String(process.env.CA_SENDER_OBSERVATION ?? '').trim(),
    address: {
      streetName: String(process.env.CA_SENDER_STREET_NAME ?? 'Sin calle').trim(),
      streetNumber: String(process.env.CA_SENDER_STREET_NUMBER ?? 'S/N').trim(),
      cityName: String(process.env.CA_SENDER_CITY ?? 'CABA').trim(),
      floor: String(process.env.CA_SENDER_FLOOR ?? '').trim(),
      department: String(process.env.CA_SENDER_DEPARTMENT ?? '').trim(),
      state: toProvinceCode(
        process.env.CA_SENDER_STATE ?? process.env.CA_SENDER_STATE_CODE ?? 'C',
      ),
      zipCode: normalizePostalCode(process.env.CA_SENDER_ZIP_CODE ?? '1000'),
    },
  };
}

function buildShippingDataFromOrder(order: OrderRow) {
  const parsedAddress = parseAddress(order.buyer_address);
  return {
    name: String(order.buyer_name ?? 'Cliente').trim(),
    areaCodePhone: '',
    phoneNumber: String(order.buyer_phone ?? '').trim(),
    areaCodeCellphone: '',
    cellphoneNumber: String(order.buyer_phone ?? '').trim(),
    email: String(order.buyer_email ?? '').trim(),
    observation: '',
    address: parsedAddress,
  };
}

function buildParcelsFromOrder(order: OrderRow) {
  const items = normalizeItems(order.items);
  const metrics = estimatePackageMetrics(items);
  const declaredValue = Math.max(1, Math.round(toNumber(order.total_amount, 0)));

  return [
    {
      dimensions: {
        height: String(metrics.heightCm),
        width: String(metrics.widthCm),
        depth: String(metrics.lengthCm),
      },
      productWeight: String(metrics.weightGrams),
      productCategory: String(process.env.CA_PRODUCT_CATEGORY ?? 'general').trim(),
      declaredValue: String(declaredValue),
    },
  ];
}

function buildCorreoOrderPayload(order: OrderRow, config: CorreoApiConfig) {
  const sellerId = String(config.sellerId || config.agreement).trim();
  return {
    sellerId,
    order: {
      senderData: buildSenderData(config),
      shippingData: buildShippingDataFromOrder(order),
      parcels: buildParcelsFromOrder(order),
      deliveryType: 'homeDelivery',
      agencyId: '',
      saleDate: formatSaleDate(order.created_at),
      shipmentClientId: String(order.id),
      serviceType: String(process.env.CA_SERVICE_TYPE ?? 'CP').trim(),
    },
  };
}

async function createCorreoOrder(
  order: OrderRow,
  config: CorreoApiConfig,
): Promise<{ trackingCode: string; sellerId: string }> {
  const payload = buildCorreoOrderPayload(order, config);
  const response = await axios.post(`${config.apiBaseUrl}/orders`, payload, {
    headers: buildCorreoHeaders(config),
    timeout: config.timeoutMs,
  });

  const data = (response.data ?? {}) as Record<string, unknown>;
  const orderData = (data.order ?? {}) as Record<string, unknown>;
  const trackingCode = String(
    data.trackingNumber ??
      data.tracking_number ??
      orderData.trackingNumber ??
      '',
  ).trim();

  if (!trackingCode) {
    throw new Error('No se pudo obtener trackingNumber desde /v1/orders');
  }

  return { trackingCode, sellerId: payload.sellerId };
}

async function requestCorreoLabel({
  trackingCode,
  sellerId,
  config,
}: {
  trackingCode: string;
  sellerId: string;
  config: CorreoApiConfig;
}): Promise<{ fileBase64: string; fileName: string; result: string }> {
  const params: Record<string, string> = {};
  if (config.labelFormat) params.labelFormat = config.labelFormat;

  const body = [
    {
      sellerId: String(sellerId || config.sellerId || config.agreement),
      trackingNumber: trackingCode,
    },
  ];
  const response = await axios.post(`${config.apiBaseUrl}/labels`, body, {
    headers: buildCorreoHeaders(config),
    params,
    timeout: config.timeoutMs,
  });

  const list = Array.isArray(response.data)
    ? response.data
    : [response.data ?? {}];
  const label =
    (list as Array<Record<string, unknown>>).find(
      (item) => String(item.trackingNumber ?? '') === String(trackingCode),
    ) ??
    list[0] ??
    {};
  const result = String(
    (label as Record<string, unknown>).result ??
      (label as Record<string, unknown>).status ??
      '',
  ).trim();

  if (
    result &&
    result.toUpperCase() !== 'OK' &&
    !result.toUpperCase().includes('OK')
  ) {
    throw new Error(`Error generando rotulo: ${result}`);
  }

  const fileBase64 = String(
    (label as Record<string, unknown>).fileBase64 ??
      (label as Record<string, unknown>).filebase64 ??
      '',
  ).trim();
  if (!fileBase64) {
    throw new Error('La API no devolvio fileBase64 para el rotulo');
  }

  return {
    fileBase64,
    fileName: String(
      (label as Record<string, unknown>).fileName ??
        (label as Record<string, unknown>).filename ??
        `label-${trackingCode}.pdf`,
    ).trim(),
    result: result || 'OK',
  };
}

export interface ShippingLabelResult {
  trackingCode: string;
  provider: string;
  source: string;
  labelText: string | null;
  labelUrl: string | null;
  labelPdfBase64?: string | null;
  reused: boolean;
}

export async function generateShippingLabel(
  order: OrderRow,
  options: { force?: boolean } = {},
): Promise<ShippingLabelResult> {
  const force = !!options.force;

  if (order.tracking_code && !force) {
    return {
      trackingCode: order.tracking_code,
      provider: 'correo_argentino',
      source: 'existing',
      labelText: null,
      labelUrl: null,
      reused: true,
    };
  }

  const shippingMethod = String(order.shipping_method ?? '').toLowerCase();
  if (shippingMethod !== 'correo_argentino') {
    throw new Error('La orden no usa Correo Argentino');
  }

  const mode = String(process.env.SHIPPING_MODE ?? 'fixed').toLowerCase();
  if (mode === 'api') {
    const config = getCorreoApiConfig();
    if (canUseCorreoApi(config)) {
      try {
        await validateCorreoCredentials(config);
        const orderResult = await createCorreoOrder(order, config);
        const { trackingCode } = orderResult;
        const label = await requestCorreoLabel({
          trackingCode,
          sellerId: orderResult.sellerId,
          config,
        });

        return {
          trackingCode,
          provider: 'correo_argentino',
          source: 'correo_api',
          labelText: `Archivo: ${label.fileName} (${label.result})`,
          labelUrl: `data:application/pdf;base64,${label.fileBase64}`,
          labelPdfBase64: label.fileBase64,
          reused: false,
        };
      } catch (error) {
        console.error(
          'generateShippingLabel api error',
          extractAxiosError(error),
        );
        const fallbackAllowed =
          String(process.env.SHIPPING_API_FALLBACK ?? 'true').toLowerCase() !==
          'false';
        if (!fallbackAllowed) throw error;
      }
    }
  }

  const trackingCode = buildManualTrackingCode(order.id);
  const labelText = [
    'Etiqueta de envio - Correo Argentino',
    `Orden: #${order.id}`,
    `Tracking: ${trackingCode}`,
    `Destinatario: ${order.buyer_name ?? 'Sin nombre'}`,
    `Email: ${order.buyer_email ?? 'Sin email'}`,
    `Telefono: ${order.buyer_phone ?? 'Sin telefono'}`,
    `Direccion: ${order.buyer_address ?? 'Sin direccion'}`,
    `Monto: ARS ${Number(order.total_amount || 0).toFixed(2)}`,
  ].join('\n');

  return {
    trackingCode,
    provider: 'correo_argentino',
    source: 'manual',
    labelText,
    labelUrl: null,
    labelPdfBase64: null,
    reused: false,
  };
}
