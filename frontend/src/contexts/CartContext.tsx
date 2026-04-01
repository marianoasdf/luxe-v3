'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import type { CartItem } from '@/types';
import { generarUniqueKey, validarCantidad } from '@/lib/utils';

interface CartContextValue {
  carrito: CartItem[];
  agregarAlCarrito: (producto: CartItem) => void;
  aumentarCantidad: (uniqueKey: string) => void;
  disminuirCantidad: (uniqueKey: string) => void;
  eliminarDelCarrito: (uniqueKey: string) => void;
  vaciarCarrito: () => void;
  total: number;
  openCartTick: number;
  triggerOpenCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [carrito, setCarrito] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const guardado = localStorage.getItem('carrito');
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });

  const [openCartTick, setOpenCartTick] = useState(0);

  useEffect(() => {
    localStorage.setItem('carrito', JSON.stringify(carrito));
  }, [carrito]);

  const agregarAlCarrito = useCallback((producto: CartItem) => {
    const cantidadValida = validarCantidad(producto.cantidad);
    const stockDisponible = Number.isFinite(Number(producto.stock)) ? Number(producto.stock) : null;
    const cantidadAAgregar = stockDisponible != null ? Math.min(cantidadValida, stockDisponible) : cantidadValida;

    if (stockDisponible === 0) {
      alert('Sin stock disponible para esta variante.');
      return;
    }

    const uniqueKey = producto.uniqueKey || generarUniqueKey(producto);

    setCarrito((prev) => {
      const existe = prev.find((item) => item.uniqueKey === uniqueKey);
      if (existe) {
        return prev.map((item) =>
          item.uniqueKey === uniqueKey
            ? {
                ...item,
                cantidad:
                  item.stock != null
                    ? Math.min(item.cantidad + cantidadAAgregar, Number(item.stock))
                    : item.cantidad + cantidadAAgregar,
              }
            : item,
        );
      }
      return [...prev, { ...producto, cantidad: cantidadAAgregar, uniqueKey }];
    });

    setOpenCartTick((t) => t + 1);
  }, []);

  const aumentarCantidad = useCallback((uniqueKey: string) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.uniqueKey === uniqueKey
          ? {
              ...item,
              cantidad: item.stock != null ? Math.min(item.cantidad + 1, Number(item.stock)) : item.cantidad + 1,
            }
          : item,
      ),
    );
  }, []);

  const disminuirCantidad = useCallback((uniqueKey: string) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.uniqueKey === uniqueKey && item.cantidad > 1 ? { ...item, cantidad: item.cantidad - 1 } : item,
      ),
    );
  }, []);

  const eliminarDelCarrito = useCallback((uniqueKey: string) => {
    setCarrito((prev) => prev.filter((item) => item.uniqueKey !== uniqueKey));
  }, []);

  const vaciarCarrito = useCallback(() => setCarrito([]), []);
  const triggerOpenCart = useCallback(() => setOpenCartTick((t) => t + 1), []);

  const total = useMemo(
    () => carrito.reduce((acc, item) => acc + item.price * item.cantidad, 0),
    [carrito],
  );

  const value = useMemo(
    () => ({
      carrito,
      agregarAlCarrito,
      aumentarCantidad,
      disminuirCantidad,
      eliminarDelCarrito,
      vaciarCarrito,
      total,
      openCartTick,
      triggerOpenCart,
    }),
    [carrito, agregarAlCarrito, aumentarCantidad, disminuirCantidad, eliminarDelCarrito, vaciarCarrito, total, openCartTick, triggerOpenCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
