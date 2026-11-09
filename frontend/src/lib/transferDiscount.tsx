'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export const MAX_TRANSFER_DISCOUNT_PERCENT = 50;

interface TransferDiscountContextValue {
  percent: number | null;
  setPercent: (percent: number) => void;
}

const TransferDiscountContext = createContext<TransferDiscountContextValue | null>(null);

/**
 * Recibe el porcentaje ya resuelto en el servidor (RootLayout) para que el
 * primer render del Header/checkout/ficha lo tenga sin ningún fetch en el cliente.
 */
export function TransferDiscountProvider({
  initial,
  children,
}: {
  initial: number | null;
  children: ReactNode;
}) {
  const [percent, setPercent] = useState<number | null>(initial);
  return (
    <TransferDiscountContext.Provider value={{ percent, setPercent }}>
      {children}
    </TransferDiscountContext.Provider>
  );
}

/** Porcentaje vigente de descuento por transferencia. `null` si el backend no respondió. */
export function useTransferDiscount(): number | null {
  return useContext(TransferDiscountContext)?.percent ?? null;
}

/** Lo usa el admin al guardar para que el header/checkout se actualicen sin recargar. */
export function useSetTransferDiscount(): (percent: number) => void {
  const ctx = useContext(TransferDiscountContext);
  if (!ctx) throw new Error('useSetTransferDiscount debe usarse dentro de TransferDiscountProvider');
  return ctx.setPercent;
}
