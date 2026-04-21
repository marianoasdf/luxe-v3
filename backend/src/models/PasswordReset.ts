import pool from '../config/db';
import crypto from 'crypto';
import type { UserRow } from '../types';

export interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  token: string;
  created_at: Date;
  used_at: Date | null;
  expires_at: Date;
}

export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetTokenRow> {
  const q = 'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3) RETURNING *';
  const { rows } = await pool.query(q, [userId, token, expiresAt]);
  return rows[0];
}

export async function getValidPasswordResetToken(token: string): Promise<PasswordResetTokenRow | undefined> {
  const q = 'SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()';
  const { rows } = await pool.query(q, [token]);
  return rows[0];
}

export async function consumePasswordResetToken(token: string): Promise<PasswordResetTokenRow | undefined> {
  const q = 'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1 RETURNING *';
  const { rows } = await pool.query(q, [token]);
  return rows[0];
}
