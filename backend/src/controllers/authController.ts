import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import UAParser from 'ua-parser-js';
import {
  getUserByEmail,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokensForUser,
  getUserTokenVersion,
  incrementTokenVersion,
  getRefreshTokenById,
  revokeRefreshTokenById,
} from '../models/User';
import { param } from '../types';
import type { AuthRequest, DeviceInfo, UserRow } from '../types';
import {
  createPasswordResetToken,
  getValidPasswordResetToken,
  consumePasswordResetToken,
} from '../models/PasswordReset';
import { sendPasswordResetEmail } from '../services/passwordResetEmail';

function buildDeviceInfo(req: AuthRequest): DeviceInfo {
  const ua = UAParser(req.headers['user-agent'] ?? '');
  return {
    ip: req.ip ?? null,
    user_agent: req.headers['user-agent'] ?? null,
    device: { browser: ua.browser, os: ua.os, device: ua.device },
  };
}

function getRefreshMaxAge(): number {
  return parseInt(process.env.REFRESH_EXPIRES_DAYS ?? '30', 10) * 24 * 60 * 60 * 1000;
}

function setRefreshCookie(res: Response, refresh: string): void {
  res.cookie('refresh', refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: getRefreshMaxAge(),
  });
}

// POST /login
export async function login(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const email = req.body.email?.trim();
  const password = req.body.password;

  if (!email || !password) {
    res.status(400).json({ error: 'Email y password obligatorios' });
    return;
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (user.email_verified === false) {
      res.status(403).json({ error: 'Debes verificar tu email antes de iniciar sesión' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ error: 'Credenciales inválidas' });
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

    const { password: _pw, ...safeUser } = user;
    setRefreshCookie(res, refresh);
    res.json({ message: 'Autenticado', user: safeUser, access });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Error en login' });
  }
}

// POST /refresh
export async function refresh(req: AuthRequest, res: Response): Promise<void> {
  const refreshToken = req.body.refresh ?? req.cookies?.refresh;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token obligatorio' });
    return;
  }

  try {
    const row = await getRefreshToken(refreshToken);
    if (!row) {
      res.status(401).json({ error: 'Refresh token inválido' });
      return;
    }

    if (row.revoked) {
      await revokeAllRefreshTokensForUser(row.user_id);
      res.status(401).json({
        error: 'Refresh token revocado (posible compromiso), se cerraron sesiones',
      });
      return;
    }

    const tv = await getUserTokenVersion(row.user_id);
    const access = jwt.sign(
      { email: '', tv },
      process.env.JWT_SECRET ?? 'devsecret',
      { subject: String(row.user_id), expiresIn: (process.env.ACCESS_EXPIRES ?? '15m') as StringValue },
    );

    const newRefresh = crypto.randomBytes(64).toString('hex');
    const newJti = crypto.randomBytes(16).toString('hex');
    const deviceInfo = buildDeviceInfo(req);
    await rotateRefreshToken(refreshToken, newRefresh, newJti, row.user_id, deviceInfo);

    setRefreshCookie(res, newRefresh);
    res.json({ access });
  } catch (err) {
    console.error('Refresh error', err);
    res.status(500).json({ error: 'Error en refresh' });
  }
}

// POST /logout
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  const refreshToken = req.body.refresh ?? req.cookies?.refresh;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token obligatorio' });
    return;
  }

  try {
    const row = await revokeRefreshToken(refreshToken);
    res.clearCookie('refresh');
    if (!row) {
      res.status(200).json({ message: 'Token no encontrado (ok)' });
      return;
    }
    res.json({ message: 'Logout ok' });
  } catch (err) {
    console.error('Logout error', err);
    res.status(500).json({ error: 'Error en logout' });
  }
}

// POST /logout-all
export async function logoutAll(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    await revokeAllRefreshTokensForUser(userId);
    const newVersion = await incrementTokenVersion(userId);
    res.clearCookie('refresh');
    res.json({ message: 'Todas las sesiones revocadas', token_version: newVersion });
  } catch (err) {
    console.error('Logout-all error', err);
    res.status(500).json({ error: 'Error en logout-all' });
  }
}

// DELETE /sessions/:id
export async function revokeSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    const sessionId = parseInt(param(req, 'id'), 10);
    if (!sessionId) {
      res.status(400).json({ error: 'Session id inválido' });
      return;
    }

    const callerId = req.user?.sub ? Number(req.user.sub) : null;
    const isAdmin = req.isAdmin === true;

    const sessRes = await getRefreshTokenById(sessionId);
    if (!isAdmin) {
      if (!sessRes || Number(sessRes.user_id) !== callerId) {
        res.status(403).json({ error: 'No autorizado para revocar esta sesión' });
        return;
      }
    }

    const revoked = await revokeRefreshTokenById(sessionId);
    if (!revoked) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }

    res.json({ message: 'Sesión revocada', session: revoked });
  } catch (err) {
    console.error('revokeSession error', err);
    res.status(500).json({ error: 'Error revocando sesión' });
  }
}

// POST /admin/users/:id/logout
export async function adminLogoutUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const targetId = parseInt(param(req, 'id'), 10);
    if (!targetId) {
      res.status(400).json({ error: 'User id inválido' });
      return;
    }

    const callerId = req.user?.id ? Number(req.user.id) : null;
    const isAdmin = req.isAdmin === true;

    if (callerId !== targetId && !isAdmin) {
      res.status(403).json({ error: 'No autorizado' });
      return;
    }

    await revokeAllRefreshTokensForUser(targetId);
    const newVersion = await incrementTokenVersion(targetId);
    res.json({ message: 'Sesiones del usuario revocadas', token_version: newVersion });
  } catch (err) {
    console.error('adminLogoutUser error', err);
    res.status(500).json({ error: 'Error en admin logout' });
  }
}

// ─── Recuperación de contraseña ───────────────────────────
// POST /forgot-password
export async function forgotPassword(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const email = req.body.email?.trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email obligatorio' });
    return;
  }
  const user = await getUserByEmail(email);
  if (!user) {
    // No revelar si existe o no
    res.json({ message: 'Si el email existe, se enviará un enlace para restablecer la contraseña.' });
    return;
  }
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
  await createPasswordResetToken(user.id, token, expiresAt);
  await sendPasswordResetEmail({ to: user.email, token });
  res.json({ message: 'Si el email existe, se enviará un enlace para restablecer la contraseña.' });
}

// POST /reset-password
export async function resetPassword(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ error: 'Token y nueva contraseña obligatorios' });
    return;
  }
  const resetToken = await getValidPasswordResetToken(token);
  if (!resetToken) {
    res.status(400).json({ error: 'Token inválido o expirado' });
    return;
  }
  const userModel = await import('../models/User.js') as typeof import('../models/User');
  const user: UserRow | undefined = await userModel.getUserById(resetToken.user_id);
  if (!user) {
    res.status(400).json({ error: 'Usuario no encontrado' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await consumePasswordResetToken(token);
  await userModel.updateUserPassword(user.id, hash);
  res.json({ message: 'Contraseña actualizada correctamente' });
}

// POST /change-password (usuario autenticado)
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const userId = req.user?.sub ? Number(req.user.sub) : null;
  if (!userId) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Contraseña actual y nueva obligatorias' });
    return;
  }
  const userModel = await import('../models/User.js') as typeof import('../models/User');
  const user: UserRow | undefined = await userModel.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    res.status(400).json({ error: 'Contraseña actual incorrecta' });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await userModel.updateUserPassword(user.id, hash);
  res.json({ message: 'Contraseña cambiada correctamente' });
}
