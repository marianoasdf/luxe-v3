'use client';

import { useEffect, useState } from 'react';

export const MAX_TRANSFER_DISCOUNT_PERCENT = 50;

let cachedPercent: number | null = null;
let pending: Promise<number | null> | null = null;
const listeners = new Set<(percent: number | null) => void>();

async function loadTransferDiscount(): Promise<number | null> {
  try {
    const res = await fetch('/api/payments/transfer-discount', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const percent = Number(data?.percent);
    return Number.isFinite(percent) ? percent : null;
  } catch {
    return null;
  }
}

function publish(percent: number | null) {
  cachedPercent = percent;
  listeners.forEach((listener) => listener(percent));
}

/** Avisa a todos los componentes montados que el porcentaje cambió (lo usa el admin al guardar). */
export function setTransferDiscountCache(percent: number) {
  publish(percent);
}

/** Porcentaje vigente de descuento por transferencia. `null` mientras carga o si falló la API. */
export function useTransferDiscount(): number | null {
  const [percent, setPercent] = useState<number | null>(cachedPercent);

  useEffect(() => {
    listeners.add(setPercent);
    if (cachedPercent === null) {
      if (!pending) {
        pending = loadTransferDiscount().then((value) => {
          pending = null;
          if (value !== null) publish(value);
          return value;
        });
      }
    } else {
      setPercent(cachedPercent);
    }
    return () => {
      listeners.delete(setPercent);
    };
  }, []);

  return percent;
}
