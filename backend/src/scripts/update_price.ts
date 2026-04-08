#!/usr/bin/env node
// update_price.ts
// Actualiza el precio de un producto por ID

import pool from '../config/db.js';

interface ProductRow {
  id: number;
  name: string;
  price: number;
  currency: string;
  updated_at: string;
}

async function main(): Promise<void> {
  try {
    const [, , idArg, priceArg] = process.argv;
    const id = parseInt(idArg ?? '', 10);
    const price = Number(priceArg);
    
    if (!id || !Number.isFinite(price) || price < 0) {
      console.error('Uso: tsx src/scripts/update_price.ts <product_id> <price>');
      process.exit(1);
    }
    
    const { rows: beforeRows } = await pool.query<ProductRow>(
      'SELECT id, name, price, currency FROM products WHERE id = $1',
      [id]
    );
    
    if (beforeRows.length === 0) {
      console.error('Producto no encontrado:', id);
      process.exit(2);
    }
    
    const before = beforeRows[0];
    const { rows } = await pool.query<ProductRow>(
      'UPDATE products SET price = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, price, currency, updated_at',
      [price, id]
    );
    
    const after = rows[0];
    console.log('OK actualizado:', {
      id: after?.id,
      name: before?.name,
      price_before: before?.price,
      price_after: after?.price,
      currency: after?.currency,
      updated_at: after?.updated_at,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Error update_price:', error.message);
    process.exit(3);
  } finally {
    try {
      await pool.end();
    } catch {
      // Ignore pool end errors
    }
  }
}

main();
