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

app.get('/api/_app_ping', (_req, res) => {
  res.json({ ok: true, where: 'app' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

export default app;
