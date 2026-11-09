// Solo para Server Components / Server Actions. El fetch en servidor no pasa por
// los rewrites de next.config.ts, así que necesita la URL absoluta del backend.
// API_SERVER_URL apunta al dominio directo del backend (sin Cloudflare): el Bot Fight Mode
// desafía los pedidos que salen de los servidores de Vercel y los responde con 403.
const API_URL = process.env.API_SERVER_URL?.trim() || 'http://localhost:4000';

export const TRANSFER_DISCOUNT_TAG = 'transfer-discount';

/** 24 h. El admin invalida con revalidateTag al guardar, así que el TTL es solo un respaldo. */
export const TRANSFER_DISCOUNT_REVALIDATE_SECONDS = 86400;

export async function getTransferDiscountServer(): Promise<number | null> {
  const url = `${API_URL}/api/payments/transfer-discount`;
  try {
    const res = await fetch(url, {
      next: { revalidate: TRANSFER_DISCOUNT_REVALIDATE_SECONDS, tags: [TRANSFER_DISCOUNT_TAG] },
    });
    if (!res.ok) {
      console.error(`getTransferDiscountServer: ${url} respondió ${res.status}`);
      return null;
    }
    const data = await res.json();
    const percent = Number(data?.percent);
    return Number.isFinite(percent) ? percent : null;
  } catch (error) {
    console.error(`getTransferDiscountServer: fallo al pedir ${url}:`, error);
    return null;
  }
}
