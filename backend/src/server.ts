import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import productRoutes from './routes/productRoutes';
import verificationRoutes from './routes/verificationRoutes';
import paymentRoutes from './routes/paymentRoutes';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Red de seguridad global ─────────────────────────────────
// Loguea errores inesperados de forma legible en vez del volcado gigante.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
  // Salimos limpio para que Railway reinicie con un estado sano.
  process.exit(1);
});

// ─── Validación de entorno en producción ────────────────────
if (process.env.NODE_ENV === 'production') {
  const urlVars = ['API_BASE_URL', 'VERIFICATION_BASE_URL'] as const;
  for (const key of urlVars) {
    const val = process.env[key] ?? '';
    if (!val) {
      console.error(`[FATAL] ${key} es obligatorio en producción.`);
      process.exit(1);
    }
    if (/localhost|127\.0\.0\.1/i.test(val)) {
      console.error(`[FATAL] ${key} apunta a localhost en producción.`);
      process.exit(1);
    }
  }
  if (!process.env.CORS_ALLOWED_ORIGINS) {
    console.error('[FATAL] CORS_ALLOWED_ORIGINS es obligatorio en producción.');
    process.exit(1);
  }
}

// Body parsing
app.use(express.json());

// Trust proxy (Cloudflare/Render)
app.set('trust proxy', 1);

// CORS
const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log('[cors] bloqueado origin', origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
    maxAge: 600,
  }),
);

// Cookies
app.use(cookieParser());

// Security headers
app.use(helmet());

// Logging
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  app.use(pinoHttp({ logger: logger as unknown as Parameters<typeof pinoHttp>[0] extends infer O ? O extends { logger?: infer L } ? L : never : never }));
} else {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url} - ${req.headers['user-agent'] || 'no-agent'}`);
    next();
  });
}

// Rate limiting for refresh
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/refresh', refreshLimiter);

// Routes
app.use('/api', userRoutes);
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', productRoutes);
app.use('/api', verificationRoutes);
app.use('/api', paymentRoutes);

// Health check
app.get('/', (_req, res) => {
  res.send('Backend funcionando 🚀');
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

export default app;
