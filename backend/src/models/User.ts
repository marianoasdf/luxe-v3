import crypto from 'crypto';
import pool from '../config/db';
import type {
  UserRow,
  RefreshTokenRow,
  EmailVerificationTokenRow,
  DeviceInfo,
} from '../types';

// ─── Create ─────────────────────────────────────────────────

export async function createUser(
  nombre: string,
  email: string,
  passwordHash: string,
): Promise<Pick<UserRow, 'id' | 'nombre' | 'email'>> {
  const query =
    'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email';
  const { rows } = await pool.query(query, [nombre, email, passwordHash]);
  return rows[0];
}

// ─── Read ───────────────────────────────────────────────────

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  return rows[0];
}

// ─── Email verification ─────────────────────────────────────

export async function createEmailVerificationToken(
  userId: number,
  token: string,
  expiresAt: Date,
): Promise<EmailVerificationTokenRow> {
  const q =
    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1,$2,$3) RETURNING *';
  const { rows } = await pool.query(q, [userId, token, expiresAt]);
  return rows[0];
}

export async function getValidEmailVerificationToken(
  token: string,
): Promise<EmailVerificationTokenRow | undefined> {
  const q =
    'SELECT * FROM email_verification_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()';
  const { rows } = await pool.query(q, [token]);
  return rows[0];
}

export async function consumeEmailVerificationToken(
  token: string,
): Promise<EmailVerificationTokenRow | undefined> {
  const q =
    'UPDATE email_verification_tokens SET used_at = NOW() WHERE token = $1 RETURNING *';
  const { rows } = await pool.query(q, [token]);
  return rows[0];
}

export async function markEmailVerified(userId: number): Promise<UserRow | undefined> {
  const q = 'UPDATE usuarios SET email_verified = true WHERE id = $1 RETURNING *';
  const { rows } = await pool.query(q, [userId]);
  return rows[0];
}

// ─── Refresh tokens ─────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshExpiresAt(): Date {
  const days = parseInt(process.env.REFRESH_EXPIRES_DAYS ?? '30', 10);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function saveRefreshToken(
  userId: number,
  token: string,
  jti: string,
  deviceInfo: DeviceInfo = { ip: null, user_agent: null, device: null },
): Promise<RefreshTokenRow> {
  const tokenHash = hashToken(token);
  const expiresAt = getRefreshExpiresAt();
  const deviceJson = deviceInfo.device ? JSON.stringify(deviceInfo.device) : null;

  const query =
    'INSERT INTO refresh_tokens (user_id, token, jti, expires_at, device_info, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *';
  const { rows } = await pool.query(query, [
    userId,
    tokenHash,
    jti,
    expiresAt,
    deviceJson,
    deviceInfo.ip,
    deviceInfo.user_agent,
  ]);
  return rows[0];
}

export async function getRefreshToken(
  token: string,
): Promise<RefreshTokenRow | undefined> {
  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token = $1',
    [tokenHash],
  );
  return rows[0];
}

export async function revokeRefreshToken(
  token: string,
): Promise<RefreshTokenRow | undefined> {
  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token = $1 RETURNING *',
    [tokenHash],
  );
  return rows[0];
}

export async function rotateRefreshToken(
  oldToken: string,
  newToken: string,
  newJti: string,
  userId: number,
  deviceInfo: DeviceInfo = { ip: null, user_agent: null, device: null },
): Promise<RefreshTokenRow> {
  const oldHash = hashToken(oldToken);
  const newHash = hashToken(newToken);
  const expiresAt = getRefreshExpiresAt();
  const deviceJson = deviceInfo.device ? JSON.stringify(deviceInfo.device) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token = $1',
      [oldHash],
    );
    const { rows } = await client.query(
      'INSERT INTO refresh_tokens (user_id, token, jti, expires_at, device_info, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [userId, newHash, newJti, expiresAt, deviceJson, deviceInfo.ip, deviceInfo.user_agent],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function revokeAllRefreshTokensForUser(
  userId: number,
): Promise<RefreshTokenRow[]> {
  const { rows } = await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE user_id = $1 RETURNING *',
    [userId],
  );
  return rows;
}

// ─── Token version ──────────────────────────────────────────

export async function getUserTokenVersion(userId: number): Promise<number | null> {
  const { rows } = await pool.query(
    'SELECT token_version FROM usuarios WHERE id = $1',
    [userId],
  );
  return rows[0]?.token_version ?? null;
}

export async function incrementTokenVersion(userId: number): Promise<number | null> {
  const { rows } = await pool.query(
    'UPDATE usuarios SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
    [userId],
  );
  return rows[0]?.token_version ?? null;
}

// ─── Session management ─────────────────────────────────────

export async function getRefreshTokenById(
  id: number,
): Promise<RefreshTokenRow | undefined> {
  const { rows } = await pool.query(
    'SELECT * FROM refresh_tokens WHERE id = $1',
    [id],
  );
  return rows[0];
}

export async function revokeRefreshTokenById(
  id: number,
): Promise<RefreshTokenRow | undefined> {
  const { rows } = await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0];
}

export async function revokeAllRefreshTokensGlobal(): Promise<number> {
  const result = await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = COALESCE(revoked_at, NOW()) WHERE revoked = false RETURNING id',
  );
  return result.rowCount ?? 0;
}

export async function incrementTokenVersionAll(): Promise<
  Array<{ id: number; token_version: number }>
> {
  const { rows } = await pool.query(
    'UPDATE usuarios SET token_version = token_version + 1 RETURNING id, token_version',
  );
  return rows;
}
