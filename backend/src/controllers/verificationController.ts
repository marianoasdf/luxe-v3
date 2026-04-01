import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import crypto from 'crypto';
import UAParser from 'ua-parser-js';
import {
  getValidEmailVerificationToken,
  consumeEmailVerificationToken,
  markEmailVerified,
  getUserById,
  saveRefreshToken,
  getUserTokenVersion,
  getUserByEmail,
  createEmailVerificationToken,
} from '../models/User';
import { getRedisClient } from '../config/redisClient';
import { sendVerificationEmail } from '../services/email';
import type { AuthRequest, DeviceInfo } from '../types';

// ─── Rate limiting ──────────────────────────────────────────

const inMemoryAttempts = new Map<
  string,
  { count: number; last: number; windowStart: number }
>();
const MAX_PER_HOUR = 3;
const COOLDOWN_MS = 60 * 1000;

async function canResend(email: string): Promise<boolean> {
  const redis = getRedisClient();
  const now = Date.now();

  if (redis) {
    const key = `rl:resend:${email}`;
    const lastKey = `rl:resend:last:${email}`;
    const [countStr, lastStr] = await redis.mGet([key, lastKey]);
    const count = countStr ? parseInt(countStr, 10) : 0;
    const last = lastStr ? parseInt(lastStr, 10) : 0;
    if (last && now - last < COOLDOWN_MS) return false;
    if (count >= MAX_PER_HOUR) return false;
    return true;
  }

  const entry = inMemoryAttempts.get(email);
  if (!entry) return true;
  if (now - entry.last < COOLDOWN_MS) return false;
  if (now - entry.windowStart > 60 * 60 * 1000) {
    inMemoryAttempts.set(email, { count: 0, last: now, windowStart: now });
    return true;
  }
  return entry.count < MAX_PER_HOUR;
}

async function registerResend(email: string): Promise<void> {
  const redis = getRedisClient();
  const now = Date.now();

  if (redis) {
    const key = `rl:resend:${email}`;
    const lastKey = `rl:resend:last:${email}`;
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    if (count === 0) {
      await redis
        .multi()
        .set(key, '1', { EX: 3600 })
        .set(lastKey, String(now), { EX: 3600 })
        .exec();
    } else {
      await redis
        .multi()
        .incr(key)
        .set(lastKey, String(now), { EX: 3600 })
        .exec();
    }
    return;
  }

  const entry = inMemoryAttempts.get(email);
  if (!entry) {
    inMemoryAttempts.set(email, { count: 1, last: now, windowStart: now });
  } else {
    inMemoryAttempts.set(email, {
      count: entry.count + 1,
      last: now,
      windowStart: entry.windowStart,
    });
  }
}

// ─── Controllers ────────────────────────────────────────────

function buildDeviceInfo(req: AuthRequest): DeviceInfo {
  const ua = UAParser(req.headers['user-agent'] ?? '');
  return {
    ip: req.ip ?? null,
    user_agent: req.headers['user-agent'] ?? null,
    device: { browser: ua.browser, os: ua.os, device: ua.device },
  };
}

export async function verifyEmail(req: AuthRequest, res: Response): Promise<void> {
  const token = (req.query.token as string) ?? req.body.token;
  if (!token) {
    res.status(400).json({ error: 'Token requerido' });
    return;
  }

  try {
    const row = await getValidEmailVerificationToken(token);
    if (!row) {
      res.status(400).json({ error: 'Token inválido o expirado' });
      return;
    }

    await consumeEmailVerificationToken(token);
    await markEmailVerified(row.user_id);

    const user = await getUserById(row.user_id);
    if (!user) {
      res.status(500).json({ error: 'Usuario no encontrado tras verificación' });
      return;
    }

    const tv = await getUserTokenVersion(user.id);
    const access = jwt.sign(
      { email: user.email, tv },
      process.env.JWT_SECRET ?? 'devsecret',
      { subject: String(user.id), expiresIn: (process.env.ACCESS_EXPIRES ?? '15m') as StringValue },
    );

    const refresh = crypto.randomBytes(64).toString('hex');
    const jti = crypto.randomBytes(16).toString('hex');
    const deviceInfo = buildDeviceInfo(req);
    await saveRefreshToken(user.id, refresh, jti, deviceInfo);

    res.cookie('refresh', refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:
        parseInt(process.env.REFRESH_EXPIRES_DAYS ?? '30', 10) * 24 * 60 * 60 * 1000,
    });

    const { password: _pw, ...safeUser } = user;
    res.json({ message: 'Email verificado', user: safeUser, access });
  } catch (err) {
    console.error('verifyEmail error', err);
    res.status(500).json({ error: 'Error verificando email' });
  }
}

export async function resendVerification(req: AuthRequest, res: Response): Promise<void> {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: 'Email requerido' });
    return;
  }

  const generic = {
    ok: true,
    message: 'Si el email existe y no está verificado, se envió un enlace.',
  };

  try {
    if (!(await canResend(email))) {
      res.status(200).json(generic);
      return;
    }

    const user = await getUserByEmail(email);
    await registerResend(email);

    if (!user || user.email_verified) {
      res.status(200).json(generic);
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createEmailVerificationToken(user.id, token, expiresAt);

    try {
      await sendVerificationEmail({ to: email, token });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[email] Falló reenvío de verificación', msg);
    }

    res.status(200).json(generic);
  } catch (err) {
    console.error('resendVerification error', err);
    res.status(500).json({ error: 'Error interno' });
  }
}
