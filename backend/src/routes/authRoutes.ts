import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import axios from 'axios';
import { getRedisClient } from '../config/redisClient';
import { login, refresh, logout } from '../controllers/authController';

const router = Router();

async function verifyTurnstileToken(token: string | undefined, remoteIp: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token || '');
    if (remoteIp) params.append('remoteip', remoteIp);
    const resp = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', params);
    return !!(resp.data && resp.data.success);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Turnstile verify error (login)', msg);
    return false;
  }
}

async function loginRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || 'unknown';
  const emailRaw = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
  const redis = getRedisClient();
  const ipKey = `rl:login:${ip}`;
  const emailKey = emailRaw ? `rl:login-email:${emailRaw}` : null;
  const LIMIT_IP = 10;
  const LIMIT_EMAIL = 10;
  const WINDOW_SECONDS = 15 * 60;
  const captchaToken = req.body?.captchaToken as string | undefined;

  try {
    let ipCount = 0;
    let emailCount = 0;
    if (redis) {
      ipCount = await redis.incr(ipKey);
      if (ipCount === 1) await redis.expire(ipKey, WINDOW_SECONDS);
      if (emailKey) {
        emailCount = await redis.incr(emailKey);
        if (emailCount === 1) await redis.expire(emailKey, WINDOW_SECONDS);
      }
    }
    const overIp = ipCount > LIMIT_IP;
    const overEmail = !!(emailKey && emailCount > LIMIT_EMAIL);
    if (overIp || overEmail) {
      const okCaptcha = await verifyTurnstileToken(captchaToken, ip);
      if (!okCaptcha) {
        res.status(429).json({
          error: 'rate_limit',
          message: 'Demasiados intentos de login. Completá el captcha para continuar.',
          require_captcha: true,
        });
        return;
      }
    }
    next();
  } catch (err) {
    console.error('loginRateLimit error', err);
    res.status(500).json({ error: 'Error interno de rate limiting' });
  }
}

router.post(
  '/login',
  [
    loginRateLimit,
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Password mínimo 6 caracteres'),
  ],
  login,
);

router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
