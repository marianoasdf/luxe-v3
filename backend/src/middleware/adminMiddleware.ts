import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthRequest, JwtPayload } from '../types';

export default function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  // Legacy header support
  const legacy = req.headers['x-admin-secret'] as string | undefined;
  if (legacy && process.env.ADMIN_SECRET && legacy === process.env.ADMIN_SECRET) {
    req.isAdmin = true;
    next();
    return;
  }

  // Bearer JWT support
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No admin credentials' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET ?? 'devsecret',
    ) as JwtPayload;

    if (!decoded?.isAdmin) {
      res.status(403).json({ error: 'Admin required' });
      return;
    }

    req.isAdmin = true;
    req.adminUser = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('adminMiddleware verify error', message);
    res.status(401).json({ error: 'Admin credentials inválidas' });
  }
}
