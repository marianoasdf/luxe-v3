// Solo para Server Components / Server Actions. El fetch en servidor no pasa por
// los rewrites de next.config.ts, así que necesita la URL absoluta del backend.
const API_URL =
  process.env.API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'http://localhost:4000';

export const TRANSFER_DISCOUNT_TAG = 'transfer-discount';

/** 24 h. El admin invalida con revalidateTag al guardar, así que el TTL es solo un respaldo. */
export const TRANSFER_DISCOUNT_REVALIDATE_SECONDS = 86400;

export async function getTransferDiscountServer(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/payments/transfer-discount`, {
      next: { revalidate: TRANSFER_DISCOUNT_REVALIDATE_SECONDS, tags: [TRANSFER_DISCOUNT_TAG] },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const percent = Number(data?.percent);
    return Number.isFinite(percent) ? percent : null;
  } catch {
    return null;
  }
}
