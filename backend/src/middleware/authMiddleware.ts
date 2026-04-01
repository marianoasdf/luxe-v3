import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserTokenVersion } from '../models/User';
import type { AuthRequest, JwtPayload } from '../types';

export default async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET ?? 'devsecret',
    ) as JwtPayload;

    const userId = decoded.sub;
    const tv = decoded.tv ?? null;

    if (tv !== null) {
      const dbTv = await getUserTokenVersion(parseInt(userId, 10));
      if (dbTv === null || dbTv !== tv) {
        res.status(401).json({ error: 'Token expirado (version mismatch)' });
        return;
      }
    }

    req.user = { id: parseInt(userId, 10), email: decoded.email, sub: parseInt(userId, 10) };

    if (decoded.isAdmin === true) {
      req.isAdmin = true;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
