'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import TransferPayment from '@/components/TransferPayment';
import { authFetch } from '@/lib/api';

interface TransferOrderDetails {
  id: number;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  expiresAt: string;
  isExpired: boolean;
}

  return (
    <Suspense>
      <TransferConfirmationPageInner />
    </Suspense>
  );
}

function TransferConfirmationPageInner() {
  const searchParams = useSearchParams();
  const { vaciarCarrito } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderDetails, setOrderDetails] = useState<TransferOrderDetails | null>(null);

  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (!orderId) {
      setError('No se encontró el número de orden');
      setLoading(false);
      return;
    }

    // Vaciar carrito al cargar
    vaciarCarrito();

    // Cargar detalles de la orden
    const loadOrderDetails = async () => {
      try {
        const res = await authFetch(`/api/payments/transfer/${orderId}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Error cargando los detalles de la orden');
        }

        setOrderDetails(data.order);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando la orden');
      } finally {
        setLoading(false);
      }
    };

    loadOrderDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full mx-auto mb-4"></div>
        <p className="text-neutral-500">Cargando detalles de tu orden...</p>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <h1 className="text-xl font-semibold text-red-800 mb-2">Error</h1>
          <p className="text-red-600">{error || 'No se pudieron cargar los detalles de la orden'}</p>
          <Link href="/" className="inline-block mt-4 text-neutral-900 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (orderDetails.isExpired) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <h1 className="text-xl font-semibold text-red-800 mb-2">Orden vencida</h1>
          <p className="text-red-600">
            El plazo de pago para esta orden ha expirado. Por favor, realiza una nueva compra.
          </p>
          <Link 
            href="/productos" 
            className="inline-block mt-6 bg-neutral-900 text-white px-6 py-3 rounded-lg hover:bg-neutral-800"
          >
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl md:text-3xl text-neutral-900 mb-2">
          Orden creada - Pendiente de pago
        </h1>
        <p className="text-neutral-500 text-sm md:text-base">
          Te enviamos un email con la informacion del pedido.
        </p>
      </div>

      <TransferPayment
        orderId={orderDetails.id}
        amount={Number(orderDetails.total_amount)}
        currency={orderDetails.currency}
        expiresAt={orderDetails.expiresAt}
      />

      <div className="mt-8 text-center">
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