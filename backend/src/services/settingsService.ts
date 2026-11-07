import pool from '../config/db';

export const DEFAULT_TRANSFER_DISCOUNT_PERCENT = 20;
export const MAX_TRANSFER_DISCOUNT_PERCENT = 50;

const TRANSFER_DISCOUNT_KEY = 'transfer_discount_percent';
const CACHE_TTL_MS = 60 * 1000;

let tableReady: Promise<void> | null = null;
let cached: { value: number; expiresAt: number } | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS store_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

export function isValidTransferDiscountPercent(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_TRANSFER_DISCOUNT_PERCENT
  );
}

export async function getTransferDiscountPercent(): Promise<number> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  await ensureTable();
  const { rows } = await pool.query('SELECT value FROM store_settings WHERE key=$1', [TRANSFER_DISCOUNT_KEY]);
  const stored = rows[0] ? Number(rows[0].value) : NaN;
  const value = isValidTransferDiscountPercent(stored) ? stored : DEFAULT_TRANSFER_DISCOUNT_PERCENT;

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function setTransferDiscountPercent(value: number): Promise<number> {
  if (!isValidTransferDiscountPercent(value)) {
    throw new Error(`El descuento debe ser un número entero entre 0 y ${MAX_TRANSFER_DISCOUNT_PERCENT}`);
  }

  await ensureTable();
  await pool.query(
    `INSERT INTO store_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [TRANSFER_DISCOUNT_KEY, String(value)],
  );

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
