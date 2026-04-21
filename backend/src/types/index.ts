import type { Request } from 'express';

// ─── User & Auth ────────────────────────────────────────────
export interface UserRow {
  id: number;
  nombre: string;
  email: string;
  password: string;
  email_verified: boolean;
  token_version: number;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, 'password'>;

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token: string;
  jti: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  device_info: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface EmailVerificationTokenRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used_at: string | null;
}

export interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  token: string;
  created_at: string;
  used_at: string | null;
  expires_at: string;
}

export interface DeviceInfo {
  ip: string | null;
  user_agent: string | null;
  device: Record<string, unknown> | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  tv?: number;
  isAdmin?: boolean;
  exp?: number;
  iat?: number;
}

// ─── Products ───────────────────────────────────────────────
export interface ProductRow {
  id: number;
  sku: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  brand: string | null;
  images: ProductImage[];
  attributes: Record<string, unknown>;
  status: 'active' | 'draft';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Aggregated fields from queries
  price_min?: number;
  price_max?: number;
  variants_count?: number;
}

export interface ProductImage {
  url: string;
  public_id?: string | null;
}

export interface VariantRow {
  id: number;
  product_id: number;
  sku: string | null;
  barcode: string | null;
  option_values: Record<string, string>;
  price: number;
  stock: number;
  image_url: string | null;
  weight_grams: number | null;
  dimensions: string | null;
  status: 'active' | 'inactive';
}

export interface CreateProductInput {
  sku?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price?: number;
  currency?: string;
  brand?: string | null;
  images?: ProductImage[];
  attributes?: Record<string, unknown>;
  status?: 'active' | 'draft';
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export interface CreateVariantInput {
  sku?: string | null;
  barcode?: string | null;
  option_values?: Record<string, string>;
  price?: number;
  stock?: number;
  image_url?: string | null;
  weight_grams?: number | null;
  dimensions?: string | null;
  status?: 'active' | 'inactive';
}

export interface UpdateVariantInput extends Partial<CreateVariantInput> {}

// ─── Orders ─────────────────────────────────────────────────
export interface OrderRow {
  id: number;
  status: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  buyer_phone: string | null;
  total_amount: number;
  currency: string;
  items: unknown;
  shipping_method: string | null;
  shipping_cost: number;
  tracking_code: string | null;
  mp_payment_id?: string | null;
  mp_payment_status?: string | null;
  mp_preference_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Shipping ───────────────────────────────────────────────
export interface ShippingInput {
  method: string;
  provider: string;
  postalCode: string;
  province: string;
  city: string;
  addressLine: string;
  reference: string;
  cost: number;
}

export interface ShippingQuote {
  provider: string;
  method: string;
  serviceCode: string;
  serviceName: string;
  zone: string;
  cost: number;
  etaDays: string;
  source: string;
  shipping?: ShippingInput;
}

export interface FixedRate {
  zone: string;
  min: number;
  max: number;
  cost: number;
  etaDays: string;
}

// ─── Address ────────────────────────────────────────────────
export interface AddressRow {
  id: number;
  user_id: number;
  recipient_name: string | null;
  phone: string | null;
  address: string;
  street_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  reference: string | null;
  source: string;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Express extensions ─────────────────────────────────────
export interface AuthRequest extends Request {
  user?: {
    id: number | string;
    email: string;
    sub: number | string;
  };
  isAdmin?: boolean;
  adminUser?: {
    id: string;
    email: string;
  };
}

/** Safely extract a route param as string (Express 5 returns string | string[]). */
export function param(req: { params: Record<string, string | string[]> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

// ─── Validated Cart Item ────────────────────────────────────
export interface ValidatedItem {
  product_id: number;
  variant_id: number | null;
  talle?: string;
  color?: string;
  name: string;
  description?: string;
  category_id?: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}
