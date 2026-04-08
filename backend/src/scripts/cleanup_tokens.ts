#!/usr/bin/env node
// cleanup_tokens.ts
// Alineado al backend: usa pg.Pool, respeta REFRESH_RETENTION_DAYS y soporta --dry-run.

import pool from '../config/db.js';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run') || ARGS.includes('-d');
const RETENTION_DAYS = parseInt(process.env.REFRESH_RETENTION_DAYS ?? process.env.REFRESH_EXPIRES_DAYS ?? '30', 10);

interface TokenCount {
  cnt: number;
}

interface DeletedToken {
  id: number;
  user_id: number;
  jti: string;
  expires_at: string;
  revoked_at: string | null;
}

interface SampleToken {
  id: number;
  user_id: number;
  jti: string;
  issued_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  ip: string | null;
  user_agent: string | null;
}

interface EmailTokenCount {
  cnt: number;
}

interface DeletedEmailToken {
  id: number;
  user_id: number;
  used_at: string | null;
  expires_at: string;
}

interface SampleEmailToken {
  id: number;
  user_id: number;
  token: string;
  created_at: string;
  used_at: string | null;
  expires_at: string;
}

async function main(): Promise<void> {
  try {
    console.log(`cleanup_tokens: retention=${RETENTION_DAYS}d dryRun=${DRY}`);

    const expiredCond = `(expires_at IS NOT NULL AND expires_at <= now())`;
    const revokedCond = `(revoked = true AND revoked_at IS NOT NULL AND revoked_at <= now() - ($1::int * interval '1 day'))`;

    const countQ = `SELECT COUNT(*)::int AS cnt FROM refresh_tokens WHERE ${expiredCond} OR ${revokedCond}`;
    const cnt = await pool.query<TokenCount>(countQ, [RETENTION_DAYS]);
    const total = cnt.rows[0]?.cnt ?? 0;
    console.log(`Filas candidatas: ${total}`);

    if (total === 0) {
      console.log('No se encontraron tokens para limpiar.');
      return;
    }

    if (DRY) {
      const sampleQ = `SELECT id, user_id, jti, issued_at, expires_at, revoked, revoked_at, ip, user_agent FROM refresh_tokens WHERE ${expiredCond} OR ${revokedCond} LIMIT 50`;
      const sample = await pool.query<SampleToken>(sampleQ, [RETENTION_DAYS]);
      console.log('Ejemplo (hasta 50 filas):');
      console.log(JSON.stringify(sample.rows, null, 2));
      return;
    }

    const delQ = `DELETE FROM refresh_tokens WHERE ${expiredCond} OR ${revokedCond} RETURNING id, user_id, jti, expires_at, revoked_at`;
    const res = await pool.query<DeletedToken>(delQ, [RETENTION_DAYS]);
    console.log(`Eliminadas: ${res.rowCount} filas`);
    if (res.rowCount && res.rowCount > 0) {
      console.log(JSON.stringify(res.rows, null, 2));
    }

    // =============================
    // Limpieza de email_verification_tokens
    // =============================
    // Expirados: expires_at <= now()
    // Usados: used_at no nulo y usado hace más de RETENTION_DAYS
    const emailExpiredCond = `expires_at <= now()`;
    const emailUsedCond = `used_at IS NOT NULL AND used_at <= now() - ($1::int * interval '1 day')`;
    const emailCountQ = `SELECT COUNT(*)::int AS cnt FROM email_verification_tokens WHERE ${emailExpiredCond} OR ${emailUsedCond}`;
    const emailCnt = await pool.query<EmailTokenCount>(emailCountQ, [RETENTION_DAYS]);
    const emailTotal = emailCnt.rows[0]?.cnt ?? 0;
    console.log(`Tokens verificación candidatos: ${emailTotal}`);
    
    if (emailTotal > 0) {
      if (DRY) {
        const emailSampleQ = `SELECT id, user_id, token, created_at, used_at, expires_at FROM email_verification_tokens WHERE ${emailExpiredCond} OR ${emailUsedCond} LIMIT 50`;
        const emailSample = await pool.query<SampleEmailToken>(emailSampleQ, [RETENTION_DAYS]);
        console.log('Ejemplo verificación (hasta 50 filas):');
        console.log(JSON.stringify(emailSample.rows, null, 2));
      } else {
        const emailDelQ = `DELETE FROM email_verification_tokens WHERE ${emailExpiredCond} OR ${emailUsedCond} RETURNING id, user_id, used_at, expires_at`;
        const emailDelRes = await pool.query<DeletedEmailToken>(emailDelQ, [RETENTION_DAYS]);
        console.log(`Email tokens eliminados: ${emailDelRes.rowCount}`);
        if (emailDelRes.rowCount && emailDelRes.rowCount > 0) {
          console.log(JSON.stringify(emailDelRes.rows, null, 2));
        }
      }
    } else {
      console.log('No hay email_verification_tokens para limpiar.');
    }
  } catch (err: unknown) {
    console.error('Error en cleanup_tokens:', err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

main();