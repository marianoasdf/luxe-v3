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
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="bg-gray-50 p-10 rounded-xl shadow-sm">
        <h1 className="text-3xl font-bold text-green-600 mb-4">¡Compra realizada con éxito!</h1>
        <p className="text-gray-600 mb-8">Gracias por tu compra. Te enviamos los detalles al mail que ingresaste.</p>
        <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
