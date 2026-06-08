export interface ProductMapped {
  id: number;
  slug: string;
  name: string;
  desc: string;
  img: string;
  price: number;
  tipo: string;
  talles: string[];
  colores: string[];
}

export interface CartItem {
  id: number;
  slug: string;
  name: string;
  desc: string;
  img: string;
  price: number;
  variant_id: number | null;
  talle: string | null;
  color: string;
  stock: number | null;
  cantidad: number;
  uniqueKey: string;
}

export interface VariantRow {
  id: number;
  product_id?: number;
  sku: string | null;
  barcode: string | null;
  option_values: Record<string, string>;
  price: number;
  stock: number;
  images: ProductImage[];
  weight_grams: number | null;
  dimensions: string | null;
  status: string;
}

export interface OrderRow {
  id: number;
  status: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  buyer_phone: string | null;
  total_amount: number;
  currency: string;
  items: OrderItem[];
  shipping_method: string | null;
  shipping_cost: number;
  tracking_code: string | null;
  mp_payment_status?: string | null;
  created_at: string;
  updated_at: string;
  // Campos opcionales para descuentos y totales originales
  original_amount?: number;
  discount_applied?: number;
}

export interface OrderItem {
  product_id: number;
  variant_id: number | null;
  name: string;
  talle?: string;
  color?: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface AddressRow {
  id: number;
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

export interface UserSafe {
  id: number;
  nombre: string;
  email: string;
  email_verified: boolean;
  created_at: string | null;
}

export interface DashboardData {
  user: UserSafe | null;
  addresses: AddressRow[];
  purchases: OrderRow[];
}

export interface ProductImage {
  url: string;
  public_id?: string | null;
}
