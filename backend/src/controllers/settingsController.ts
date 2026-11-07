import type { Request, Response } from 'express';
import {
  getTransferDiscountPercent,
  setTransferDiscountPercent,
  isValidTransferDiscountPercent,
  MAX_TRANSFER_DISCOUNT_PERCENT,
} from '../services/settingsService';

export async function getTransferDiscount(_req: Request, res: Response): Promise<void> {
  try {
    const percent = await getTransferDiscountPercent();
    res.json({ percent });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('getTransferDiscount error:', msg);
    res.status(500).json({ error: 'Error obteniendo el descuento por transferencia' });
  }
}

export async function adminUpdateTransferDiscount(req: Request, res: Response): Promise<void> {
  try {
    const raw = req.body?.percent;
    const percent = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    if (!isValidTransferDiscountPercent(percent)) {
      res.status(400).json({ error: `El descuento debe ser un número entero entre 0 y ${MAX_TRANSFER_DISCOUNT_PERCENT}` });
      return;
    }
    const saved = await setTransferDiscountPercent(percent);
    res.json({ percent: saved });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('adminUpdateTransferDiscount error:', msg);
    res.status(500).json({ error: 'Error guardando el descuento por transferencia' });
  }
}
