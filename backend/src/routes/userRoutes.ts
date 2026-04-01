import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import axios from 'axios';
import { getRedisClient } from '../config/redisClient';
import authMiddleware from '../middleware/authMiddleware';
import {
  registerUser,
  getMyDashboard,
  createMyAddress,
  updateMyAddress,
  setPrimaryMyAddress,
} from '../controllers/userController';

const router = Router();

const disposableDomains = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'yopmail.com',
];

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
    console.error('Turnstile verify error (register)', msg);
    return false;
  }
}

async function registerRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || 'unknown';
  const emailRaw = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
  const redis = getRedisClient();
  const ipKey = `rl:register:${ip}`;
  const emailKey = emailRaw ? `rl:register-email:${emailRaw}` : null;
  const LIMIT_IP = 5;
  const LIMIT_EMAIL = 5;
  const WINDOW_SECONDS = 60 * 60;
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
          message: 'Demasiados intentos de registro. Completá el captcha para continuar.',
          require_captcha: true,
        });
        return;
      }
    }
    next();
  } catch (err) {
    console.error('registerRateLimit error', err);
    res.status(500).json({ error: 'Error interno de rate limiting' });
  }
}

function isAllowedEmail(value: string): boolean {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  return !disposableDomains.includes(domain);
}

router.post(
  '/register',
  [
    registerRateLimit,
    body('nombre').isLength({ min: 2 }).withMessage('Nombre inválido'),
    body('email').custom(isAllowedEmail).withMessage('Email inválido o dominio no permitido'),
    body('password').isLength({ min: 6 }).withMessage('Password mínimo 6 caracteres'),
  ],
  registerUser,
);

router.get('/me/dashboard', authMiddleware, getMyDashboard);
router.post('/me/addresses', authMiddleware, createMyAddress);
router.put('/me/addresses/:id', authMiddleware, updateMyAddress);
router.patch('/me/addresses/:id/primary', authMiddleware, setPrimaryMyAddress);

export default router;
