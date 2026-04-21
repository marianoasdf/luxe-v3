#!/usr/bin/env node
// init_db.ts
// Script de inicialización de base de datos en TypeScript

import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env') });

let client: Client;

if (process.env.DATABASE_URL) {
  // Conexión a Neon o remota
  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Conexión local
  client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });
}

const createTableQuery = `
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);
`;

const createRefreshTable = `
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  jti TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked BOOLEAN DEFAULT false
);
`;

async function seedProducts(): Promise<void> {
  // Seed mínimo: insertar productos/variantes de ejemplo si está vacío
  const res = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM products');
  const count = res.rows[0]?.count ?? 0;
  
  if (count > 0) {
    console.log('Productos existentes detectados, se omite seed');
    return;
  }
  
  console.log('Insertando seed de productos y variantes...');
  
  await client.query('BEGIN');
  
  try {
    const r1 = await client.query<{ id: number }>(
      `INSERT INTO products (sku, name, slug, description, price, currency, brand, images, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
       RETURNING id`,
      [
        'TSHIRT-BASE',
        'Remera básica',
        'remera-basica',
        'Remera de algodón peinado 24/1',
        17999.00,
        'ARS',
        'Luxe',
        JSON.stringify([{url:'/img/remera-basica.jpg', alt:'Remera básica', position:0}]),
        JSON.stringify({material:'algodon', tipo:'remera'})
      ]
    );
    
    const productId1 = r1.rows[0]?.id;
    if (productId1) {
      const vars = [
        { sku: 'TSHIRT-BASE-NG-M', opt: {color:'Negro', talle:'M'}, price: null as number | null, stock: 20 },
        { sku: 'TSHIRT-BASE-NG-L', opt: {color:'Negro', talle:'L'}, price: null as number | null, stock: 15 },
        { sku: 'TSHIRT-BASE-BL-M', opt: {color:'Blanco', talle:'M'}, price: 18999.00, stock: 10 }
      ];
      
      for (const v of vars) {
        await client.query(
          `INSERT INTO product_variants (product_id, sku, option_values, price, stock)
           VALUES ($1,$2,$3::jsonb,$4,$5)`,
          [productId1, v.sku, JSON.stringify(v.opt), v.price, v.stock]
        );
      }
    }
    
    const r2 = await client.query<{ id: number }>(
      `INSERT INTO products (sku, name, slug, description, price, currency, brand, images, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
       RETURNING id`,
      [
        'HOODIE-BASE',
        'Buzo canguro',
        'buzo-canguro',
        'Buzo frisa liviana 30/1',
        32999.00,
        'ARS',
        'Luxe',
        JSON.stringify([{url:'/img/buzo-canguro.jpg', alt:'Buzo canguro', position:0}]),
        JSON.stringify({material:'algodon', tipo:'buzo'})
      ]
    );
    
    const productId2 = r2.rows[0]?.id;
    if (productId2) {
      const vars = [
        { sku: 'HOODIE-BASE-GR-M', opt: {color:'Gris', talle:'M'}, price: null as number | null, stock: 8 },
        { sku: 'HOODIE-BASE-NG-M', opt: {color:'Negro', talle:'M'}, price: null as number | null, stock: 5 }
      ];
      
      for (const v of vars) {
        await client.query(
          `INSERT INTO product_variants (product_id, sku, option_values, price, stock)
           VALUES ($1,$2,$3::jsonb,$4,$5)`,
          [productId2, v.sku, JSON.stringify(v.opt), v.price, v.stock]
        );
      }
    }
    
    await client.query('COMMIT');
    console.log('Seed de productos insertado');
  } catch (e: unknown) {
    console.error('Error en seed de productos:', e instanceof Error ? e.message : String(e));
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
  }
}

async function main(): Promise<void> {
  try {
    await client.connect();
    console.log(`Conectado a PostgreSQL ${process.env.PGHOST}:${process.env.PGPORT} db=${process.env.PGDATABASE}`);
    
    await client.query(createTableQuery);
    console.log('Tabla "usuarios" creada o ya existe');
    
    await client.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false");
    console.log('Columna "email_verified" asegurada en usuarios');
    
    await client.query(createRefreshTable);
    console.log('Tabla "refresh_tokens" creada o ya existe');
    
    await client.query("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE");
    console.log('Asegurada columna "revoked_at" en refresh_tokens (si no existía)');
    
    await client.query("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_info JSONB");
    console.log('Asegurada columna "device_info" en refresh_tokens (si no existía)');
    
    await client.query("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip INET");
    console.log('Asegurada columna "ip" en refresh_tokens (si no existía)');
    
    await client.query("ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT");
    console.log('Asegurada columna "user_agent" en refresh_tokens (si no existía)');
    
    await client.query("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)");
    console.log('Asegurado índice idx_refresh_tokens_user_id en refresh_tokens(user_id)');
    
    await client.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0");
    console.log('Asegurada columna "token_version" en usuarios (si no existía)');
    
    await client.query(`CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '1 day')
    );`);
    console.log('Tabla "email_verification_tokens" creada o ya existe');

    // Tabla para recuperación de contraseña
    await client.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '1 hour')
    );`);
    console.log('Tabla "password_reset_tokens" creada o ya existe');
    
    // =============================
    // Esquema de productos (opción B con variantes)
    // =============================
    const createProducts = `
      CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        sku TEXT UNIQUE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
        currency CHAR(3) NOT NULL DEFAULT 'ARS',
        brand TEXT,
        images JSONB NOT NULL DEFAULT '[]',
        attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        search_tsv tsvector GENERATED ALWAYS AS (
          to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(description,''))
        ) STORED
      );`;
    await client.query(createProducts);
    console.log('Tabla "products" creada o ya existe');
    
    const createVariants = `
      CREATE TABLE IF NOT EXISTS product_variants (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku TEXT UNIQUE,
        barcode TEXT UNIQUE,
        option_values JSONB NOT NULL DEFAULT '{}'::jsonb,
        option_hash TEXT GENERATED ALWAYS AS (md5(option_values::text)) STORED,
        price NUMERIC(12,2) CHECK (price >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        image_url TEXT,
        weight_grams INTEGER,
        dimensions JSONB,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (product_id, option_hash),
        CHECK (jsonb_typeof(option_values) = 'object')
      );`;
    await client.query(createVariants);
    console.log('Tabla "product_variants" creada o ya existe');
    
    const createVariantImages = `
      CREATE TABLE IF NOT EXISTS product_variant_images (
        id BIGSERIAL PRIMARY KEY,
        variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        alt TEXT,
        position INTEGER NOT NULL DEFAULT 0
      );`;
    await client.query(createVariantImages);
    console.log('Tabla "product_variant_images" creada o ya existe');
    
    const createCategories = `
      CREATE TABLE IF NOT EXISTS categories (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL
      );`;
    await client.query(createCategories);
    console.log('Tabla "categories" creada o ya existe');
    
    const createProductCategories = `
      CREATE TABLE IF NOT EXISTS product_categories (
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, category_id)
      );`;
    await client.query(createProductCategories);
    console.log('Tabla "product_categories" creada o ya existe');
    
    // Índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
      CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (search_tsv);
      CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING GIN (attributes);
      CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
      CREATE INDEX IF NOT EXISTS idx_variants_status ON product_variants(status);
      CREATE INDEX IF NOT EXISTS idx_variants_option_values ON product_variants USING GIN (option_values);
    `);
    console.log('Índices de products y variants asegurados');
    
    // Tabla de órdenes (MVP pagos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
        buyer_name TEXT,
        buyer_email TEXT,
        buyer_address TEXT,
        buyer_phone TEXT,
        currency CHAR(3) NOT NULL DEFAULT 'ARS',
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        items JSONB NOT NULL DEFAULT '[]',
        shipping_method TEXT,
        shipping_cost NUMERIC(12,2),
        tracking_code TEXT,
        mp_preference_id TEXT,
        mp_payment_id TEXT,
        mp_payment_status TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabla "orders" creada o ya existe');
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
        console.log('Índice idx_orders_status asegurado');

        // Columnas adicionales para pagos por transferencia
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2);`);
        console.log('Asegurada columna "original_amount" en orders');
    
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(12,2);`);
        console.log('Asegurada columna "discount_applied" en orders');
    
        await seedProducts();
  } catch (err: unknown) {
    console.error('Error al crear la tabla:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
