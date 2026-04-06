import type { CartItem } from '@/types';

export const formatoPrecio = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(n);

export const generarUniqueKey = (producto: { id: number; talle?: string | null; color?: string }): string =>
  `${producto.id}-${producto.talle ?? ''}-${producto.color ?? ''}`;

export const validarCantidad = (cantidad: number | string | undefined): number => {
  const n = Number(cantidad);
  return n > 0 ? n : 1;
};

export const formatTalle = (talle: string | null | undefined): string | null => {
  if (talle == null) return null;
  return talle.trim() === '' ? 'Unico' : talle;
};

export const cdnImage = (url: string | undefined, transforms = 'f_auto,q_auto'): string => {
  if (!url || typeof url !== 'string') return url ?? '';
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const before = url.slice(0, idx + marker.length);
  const after = url.slice(idx + marker.length);
  const hasTransforms = /^(?:[a-zA-Z]_\w+|[a-zA-Z]{1,2}_)/.test(after);
  if (hasTransforms) {
    if (after.includes('f_auto') || after.includes(transforms.split(',')[0])) return url;
    return before + transforms + ',' + after;
  }
  return before + transforms + '/' + after;
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function composeAddress(address: {
  street_address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  address?: string | null;
}): string {
  const parts = [address.street_address, address.city, address.province, address.postal_code]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  return address.address || '';
}
