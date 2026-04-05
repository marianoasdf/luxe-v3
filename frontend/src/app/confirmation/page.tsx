'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';

export default function ConfirmationPage() {
  const { vaciarCarrito } = useCart();

  useEffect(() => {
    vaciarCarrito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="border border-neutral-100 p-10 md:p-14">
        <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="font-display text-2xl md:text-3xl text-neutral-900 mb-3">¡Compra realizada con éxito!</h1>
        <p className="text-neutral-500 text-sm md:text-base mb-8">Gracias por tu compra. Te enviamos los detalles al mail que ingresaste.</p>
        <Link
          href="/"
          className="inline-block bg-neutral-900 text-white px-8 py-3 text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
