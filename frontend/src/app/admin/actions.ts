'use server';

import { revalidateTag } from 'next/cache';
import { TRANSFER_DISCOUNT_TAG } from '@/lib/server/transferDiscount';

/**
 * Invalida la caché del descuento por transferencia en el servidor de Next.
 * Solo toca la caché (no la DB), por eso no requiere el admin secret:
 * el PUT real sigue protegido por adminCheck en el backend.
 */
export async function revalidateTransferDiscount(): Promise<void> {
  revalidateTag(TRANSFER_DISCOUNT_TAG);
}
