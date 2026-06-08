import type { Response } from 'express';
import { getRedisClient } from '../config/redisClient';
import {
  listProducts,
  getProductBySlug,
  listVariantsByProductId,
  listAllProductsAdmin,
  createProductAdmin,
  updateProductAdmin,
  deleteProductAdmin,
  getProductById,
  listVariantsAdmin,
  createVariantAdmin,
  updateVariantAdmin,
  deleteVariantAdmin,
} from '../models/Product';
import { renamePublicId } from './cloudinaryController';
import { param } from '../types';
import type { AuthRequest, ProductImage } from '../types';

// ─── Cache ──────────────────────────────────────────────────

async function invalidateProductCaches(slug?: string | null): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.del('cache:products:list');
    if (slug) await redis.del(`cache:product:${slug}`);
  } catch { /* noop */ }
}

// ─── Public ─────────────────────────────────────────────────

export async function getProducts(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const redis = getRedisClient();
    const cacheKey = 'cache:products:list';

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json({ products: JSON.parse(cached), cache: true });
        return;
      }
    }

    const products = await listProducts();
    if (redis) await redis.set(cacheKey, JSON.stringify(products), { EX: 300 });
    res.json({ products });
  } catch (err) {
    console.error('getProducts error:', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

export async function getProductDetail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const slug = param(req, 'slug');
    const redis = getRedisClient();
    const cacheKey = `cache:product:${slug}`;

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }
    }

    const product = await getProductBySlug(slug);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }
    const variants = await listVariantsByProductId(product.id);
    const payload = { product, variants };
    if (redis) await redis.set(cacheKey, JSON.stringify(payload), { EX: 300 });
    res.json(payload);
  } catch (err) {
    console.error('getProductDetail error:', err);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

export async function getVariants(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(param(req, 'id'), 10);
    const variants = await listVariantsByProductId(id);
    res.json({ variants });
  } catch (err) {
    console.error('getVariants error:', err);
    res.status(500).json({ error: 'Error al obtener variantes' });
  }
}

// ─── Admin Products ─────────────────────────────────────────

export async function adminListProducts(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const rows = await listAllProductsAdmin();
    res.json({ products: rows });
  } catch (err) {
    console.error('adminListProducts error', err);
    res.status(500).json({ error: 'Error listando productos' });
  }
}

export async function adminGetProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(param(req, 'id'), 10);
    const row = await getProductById(id);
    if (!row) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json({ product: row });
  } catch (err) {
    console.error('adminGetProduct error', err);
    res.status(500).json({ error: 'Error obteniendo producto' });
  }
}

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeImages(raw: unknown): ProductImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: unknown) => (typeof x === 'string' ? { url: x } : x) as ProductImage)
    .filter((x) => x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url))
    .map((x) => ({ url: x.url, public_id: x.public_id ?? null }));
}

export async function adminCreateProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    if (!body.name || !body.slug) {
      res.status(400).json({ error: 'name y slug son obligatorios' });
      return;
    }

    const normSlug = normalizeSlug(String(body.slug));
    const price = body.price != null ? Number(body.price) : 0;
    if (Number.isNaN(price) || price < 0) {
      res.status(400).json({ error: 'Precio inválido' });
      return;
    }

    const allowedStatus = ['active', 'draft'] as const;
    const status = allowedStatus.includes(body.status) ? body.status : 'active';
    const images = normalizeImages(body.images);

    const created = await createProductAdmin({
      sku: body.sku ?? null,
      name: String(body.name).trim(),
      slug: normSlug,
      description: body.description ?? null,
      price,
      currency: 'ARS',
      brand: body.brand ?? null,
      images,
      attributes: body.attributes && typeof body.attributes === 'object' ? body.attributes : {},
      status,
    });

    if (!created.sku) {
      try {
        const updatedSku = await updateProductAdmin(created.id, { sku: `SKU-${created.id}` });
        if (updatedSku) created.sku = updatedSku.sku;
      } catch { /* noop */ }
    }

    await invalidateProductCaches(created.slug);
    res.status(201).json({ product: created });
  } catch (err: unknown) {
    console.error('adminCreateProduct error', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'SKU o slug duplicado' });
      return;
    }
    res.status(500).json({ error: 'Error creando producto' });
  }
}

export async function adminUpdateProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(param(req, 'id'), 10);
    const existing = await getProductById(id);
    if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

    const body = req.body ?? {};
    const normSlug = body.slug ? normalizeSlug(String(body.slug)) : existing.slug;
    const price = body.price != null ? Number(body.price) : existing.price;
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ error: 'Precio inválido' });
      return;
    }

    const allowedStatus = ['active', 'draft'] as const;
    const status = body.status
      ? (allowedStatus.includes(body.status) ? body.status : existing.status)
      : existing.status;

    let images: ProductImage[];
    if (body.images != null) {
      images = normalizeImages(body.images);
    } else {
      images = existing.images;
    }

    // Rename Cloudinary assets if slug changed
    if (existing.slug !== normSlug && Array.isArray(images) && images.length) {
      try {
        const oldPrefix = `products/${existing.slug}/`;
        const newPrefix = `products/${normSlug}/`;
        const renamed: ProductImage[] = [];
        for (const img of images) {
          if (img.public_id && img.public_id.startsWith(oldPrefix)) {
            const leaf = img.public_id.substring(oldPrefix.length);
            const newLeaf = leaf.replace(new RegExp(`^${existing.slug}-`), `${normSlug}-`);
            const toPublicId = newPrefix + newLeaf;
            const r = await renamePublicId(img.public_id, toPublicId);
            renamed.push({ url: r.secure_url ?? img.url, public_id: r.public_id ?? toPublicId });
          } else {
            renamed.push(img);
          }
        }
        images = renamed;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('Rename Cloudinary on slug change failed:', msg);
      }
    }

    const updated = await updateProductAdmin(id, {
      sku: body.sku ?? existing.sku,
      name: body.name != null ? String(body.name).trim() : existing.name,
      slug: normSlug,
      description: body.description ?? existing.description,
      price,
      currency: 'ARS',
      brand: body.brand ?? existing.brand,
      images,
      attributes: body.attributes && typeof body.attributes === 'object' ? body.attributes : existing.attributes,
      status,
    });

    if (!updated) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

    if (existing.slug !== updated.slug) await invalidateProductCaches(existing.slug);
    await invalidateProductCaches(updated.slug);
    res.json({ product: updated });
  } catch (err: unknown) {
    console.error('adminUpdateProduct error', err);
    const pgErr = err as { code?: string; detail?: string; message?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'SKU o slug duplicado' });
      return;
    }
    res.status(500).json({ error: 'Error actualizando producto', detail: pgErr.detail ?? pgErr.message });
  }
}

export async function adminDeleteProduct(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(param(req, 'id'), 10);
    const deleted = await deleteProductAdmin(id);
    if (!deleted) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    await invalidateProductCaches(deleted.slug);
    res.json({ product: deleted });
  } catch (err) {
    console.error('adminDeleteProduct error', err);
    res.status(500).json({ error: 'Error eliminando producto' });
  }
}

// ─── Admin Variants ─────────────────────────────────────────

export async function adminListVariantsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const productId = parseInt(param(req, 'productId'), 10);
    const variants = await listVariantsAdmin(productId);
    res.json({ variants });
  } catch (err) {
    console.error('adminListVariants error', err);
    res.status(500).json({ error: 'Error listando variantes' });
  }
}

export async function adminCreateVariantHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const productId = parseInt(param(req, 'productId'), 10);
    const body = req.body ?? {};
    const price = body.price != null ? Number(body.price) : 0;
    if (Number.isNaN(price) || price < 0) { res.status(400).json({ error: 'Precio inválido' }); return; }
    const stock = body.stock != null ? Number(body.stock) : 0;
    if (Number.isNaN(stock) || stock < 0) { res.status(400).json({ error: 'Stock inválido' }); return; }

    const variant = await createVariantAdmin(productId, {
      sku: body.sku ?? null,
      barcode: body.barcode ?? null,
      option_values: body.option_values && typeof body.option_values === 'object' ? body.option_values : {},
      price,
      stock,
      images: Array.isArray(body.images)
        ? body.images.filter((img: unknown) =>
            img && typeof img === 'object' && typeof (img as { url?: unknown }).url === 'string',
          )
        : undefined,
      weight_grams: body.weight_grams ?? null,
      dimensions: body.dimensions ?? null,
      status: body.status ?? 'active',
    });

    const product = await getProductById(productId);
    if (product) await invalidateProductCaches(product.slug);
    res.status(201).json({ variant });
  } catch (err) {
    console.error('adminCreateVariant error', err);
    res.status(500).json({ error: 'Error creando variante' });
  }
}

export async function adminUpdateVariantHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const variantId = parseInt(param(req, 'variantId'), 10);
    const body = req.body ?? {};
    const price = body.price != null ? Number(body.price) : undefined;
    if (price != null && (Number.isNaN(price) || price < 0)) { res.status(400).json({ error: 'Precio inválido' }); return; }
    const stock = body.stock != null ? Number(body.stock) : undefined;
    if (stock != null && (Number.isNaN(stock) || stock < 0)) { res.status(400).json({ error: 'Stock inválido' }); return; }

    const variant = await updateVariantAdmin(variantId, {
      sku: body.sku,
      barcode: body.barcode,
      option_values: body.option_values && typeof body.option_values === 'object' ? body.option_values : undefined,
      price,
      stock,
      images: Array.isArray(body.images)
        ? body.images.filter((img: unknown) =>
            img && typeof img === 'object' && typeof (img as { url?: unknown }).url === 'string',
          )
        : undefined,
      weight_grams: body.weight_grams,
      dimensions: body.dimensions,
      status: body.status,
    });

    if (!variant) { res.status(404).json({ error: 'Variante no encontrada' }); return; }

    const product = await getProductById(variant.product_id);
    if (product) await invalidateProductCaches(product.slug);
    res.json({ variant });
  } catch (err) {
    console.error('adminUpdateVariant error', err);
    res.status(500).json({ error: 'Error actualizando variante' });
  }
}

export async function adminDeleteVariantHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const variantId = parseInt(param(req, 'variantId'), 10);
    const variant = await deleteVariantAdmin(variantId);
    if (!variant) { res.status(404).json({ error: 'Variante no encontrada' }); return; }

    if (variant.product_id) {
      const product = await getProductById(variant.product_id);
      if (product) await invalidateProductCaches(product.slug);
    }

    res.json({ variant });
  } catch (err) {
    console.error('adminDeleteVariant error', err);
    res.status(500).json({ error: 'Error eliminando variante' });
  }
}
