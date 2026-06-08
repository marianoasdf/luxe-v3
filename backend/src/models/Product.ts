import pool from '../config/db';
import type {
  ProductRow,
  VariantRow,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  ProductImage,
} from '../types';

// ─── Public queries ─────────────────────────────────────────

export async function listProducts(): Promise<ProductRow[]> {
  const query = `
    SELECT 
      p.id, p.sku, p.name, p.slug, p.description, p.price, p.currency, p.brand,
      p.images, p.attributes, p.status, p.created_at, p.updated_at,
      MIN(COALESCE(v.price, p.price)) AS price_min,
      MAX(COALESCE(v.price, p.price)) AS price_max,
      COUNT(v.id) AS variants_count
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'active'
    WHERE p.status = 'active' AND p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC`;
  const { rows } = await pool.query(query);
  return rows;
}

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE slug = $1 AND (deleted_at IS NULL) LIMIT 1',
    [slug],
  );
  return rows[0] ?? null;
}

export async function listVariantsByProductId(
  productId: number,
): Promise<VariantRow[]> {
  const { rows } = await pool.query(
    `SELECT
       id,
       product_id,
       sku,
       barcode,
       option_values,
       price,
       stock,
       COALESCE(images, '[]'::jsonb) AS images,
       weight_grams,
       dimensions,
       status
     FROM product_variants
     WHERE product_id = $1 AND status = 'active'
     ORDER BY id`,
    [productId],
  );
  return rows;
}

// ─── Admin CRUD ─────────────────────────────────────────────

export async function getProductById(id: number): Promise<ProductRow | null> {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  return rows[0] ?? null;
}

export async function listAllProductsAdmin(): Promise<ProductRow[]> {
  const { rows } = await pool.query(`
    SELECT id, sku, name, slug, description, price, currency, brand, images, attributes, status, created_at, updated_at, deleted_at
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);
  return rows;
}

export async function createProductAdmin(
  p: CreateProductInput,
): Promise<ProductRow> {
  const {
    sku = null,
    name,
    slug,
    description = null,
    price = 0,
    currency = 'ARS',
    brand = null,
    images = [],
    attributes = {},
    status = 'active',
  } = p;

  const { rows } = await pool.query(
    `INSERT INTO products (sku, name, slug, description, price, currency, brand, images, attributes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
     RETURNING *`,
    [
      sku,
      name,
      slug,
      description,
      price,
      currency,
      brand,
      JSON.stringify(images),
      JSON.stringify(attributes),
      status,
    ],
  );
  return rows[0];
}

export async function updateProductAdmin(
  id: number,
  p: UpdateProductInput,
): Promise<ProductRow | null> {
  const existing = await getProductById(id);
  if (!existing) return null;

  const merged = {
    sku: p.sku ?? existing.sku,
    name: p.name ?? existing.name,
    slug: p.slug ?? existing.slug,
    description: p.description ?? existing.description,
    price: p.price ?? existing.price,
    currency: p.currency ?? existing.currency,
    brand: p.brand ?? existing.brand,
    images: p.images ?? existing.images,
    attributes: p.attributes ?? existing.attributes,
    status: p.status ?? existing.status,
  };

  const { rows } = await pool.query(
    `UPDATE products SET sku=$1, name=$2, slug=$3, description=$4, price=$5, currency=$6, brand=$7, images=$8::jsonb, attributes=$9::jsonb, status=$10, updated_at=NOW()
     WHERE id=$11 AND deleted_at IS NULL RETURNING *`,
    [
      merged.sku,
      merged.name,
      merged.slug,
      merged.description,
      merged.price,
      merged.currency,
      merged.brand,
      JSON.stringify(merged.images ?? []),
      JSON.stringify(merged.attributes ?? {}),
      merged.status,
      id,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteProductAdmin(id: number): Promise<ProductRow | null> {
  const { rows } = await pool.query(
    'UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
    [id],
  );
  return rows[0] ?? null;
}

// ─── Admin Variants ─────────────────────────────────────────

export async function listVariantsAdmin(productId: number): Promise<VariantRow[]> {
  const { rows } = await pool.query(
    `SELECT
       id,
       product_id,
       sku,
       barcode,
       option_values,
       price,
       stock,
       COALESCE(images, '[]'::jsonb) AS images,
       weight_grams,
       dimensions,
       status
     FROM product_variants
     WHERE product_id = $1
     ORDER BY id`,
    [productId],
  );
  return rows;
}

export async function createVariantAdmin(
  productId: number,
  v: CreateVariantInput,
): Promise<VariantRow> {
  const {
    sku = null,
    barcode = null,
    option_values = {},
    price = 0,
    stock = 0,
    images = [],
    weight_grams = null,
    dimensions = null,
    status = 'active',
  } = v;

  const normalizedImages = Array.isArray(images)
    ? images
        .filter((img): img is ProductImage => Boolean(img) && typeof img === 'object' && typeof img.url === 'string' && img.url.trim() !== '')
        .map((img) => {
          const url = img.url.trim();
          const publicId = typeof img.public_id === 'string' && img.public_id.trim() !== '' ? img.public_id.trim() : undefined;
          return publicId ? { url, public_id: publicId } : { url };
        })
    : [];

  const { rows } = await pool.query(
    `INSERT INTO product_variants (
       product_id,
       sku,
       barcode,
       option_values,
       price,
       stock,
       images,
       weight_grams,
       dimensions,
       status
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING
       id,
       sku,
       barcode,
       option_values,
       price,
       stock,
       COALESCE(images, '[]'::jsonb) AS images,
       weight_grams,
       dimensions,
       status,
       product_id`,
    [
      productId,
      sku,
      barcode,
      JSON.stringify(option_values),
      price,
      stock,
      JSON.stringify(normalizedImages),
      weight_grams,
      dimensions,
      status,
    ],
  );
  return rows[0];
}

export async function getVariantById(
  variantId: number,
): Promise<VariantRow | null> {
  const { rows } = await pool.query(
    `SELECT
       id,
       product_id,
       sku,
       barcode,
       option_values,
       price,
       stock,
       COALESCE(images, '[]'::jsonb) AS images,
       weight_grams,
       dimensions,
       status
     FROM product_variants
     WHERE id = $1`,
    [variantId],
  );
  return rows[0] ?? null;
}

export async function updateVariantAdmin(
  variantId: number,
  v: UpdateVariantInput,
): Promise<VariantRow | null> {
  const existing = await getVariantById(variantId);
  if (!existing) return null;

  const {
    sku = existing.sku,
    barcode = existing.barcode,
    option_values = existing.option_values,
    price = existing.price,
    stock = existing.stock,
    images,
    weight_grams = existing.weight_grams,
    dimensions = existing.dimensions,
    status = existing.status,
  } = v;

  const normalizedImages = Array.isArray(images)
    ? images
        .filter((img): img is ProductImage => Boolean(img) && typeof img === 'object' && typeof img.url === 'string' && img.url.trim() !== '')
        .map((img) => {
          const url = img.url.trim();
          const publicId = typeof img.public_id === 'string' && img.public_id.trim() !== '' ? img.public_id.trim() : undefined;
          return publicId ? { url, public_id: publicId } : { url };
        })
    : existing.images ?? [];

  const { rows } = await pool.query(
    `UPDATE product_variants 
     SET
       sku = $1,
       barcode = $2,
       option_values = $3::jsonb,
       price = $4,
       stock = $5,
       images = $6::jsonb,
       weight_grams = $7,
       dimensions = $8,
       status = $9
     WHERE id = $10
     RETURNING
       id,
       sku,
       barcode,
       option_values,
       price,
       stock,
       COALESCE(images, '[]'::jsonb) AS images,
       weight_grams,
       dimensions,
       status,
       product_id`,
    [
      sku,
      barcode,
      JSON.stringify(option_values),
      price,
      stock,
      JSON.stringify(normalizedImages),
      weight_grams,
      dimensions,
      status,
      variantId,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteVariantAdmin(
  variantId: number,
): Promise<VariantRow | null> {
  const { rows } = await pool.query(
    'DELETE FROM product_variants WHERE id = $1 RETURNING *',
    [variantId],
  );
  return rows[0] ?? null;
}
