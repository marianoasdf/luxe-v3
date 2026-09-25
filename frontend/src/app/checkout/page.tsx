
"use client";


import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { formatTalle, formatoPrecio } from '@/lib/utils';
import TransferCheckout from './TransferCheckout';
import { createTransferOrder } from '@/lib/payment';
import {
  normalizarCartItem,
  calcularSubtotal,
  calcularEnvio,
  calcularDescuentoTransferencia,
  calcularTotalOriginal,
  calcularTotalConDescuento,
  TRANSFER_DISCOUNT_PERCENT,
} from '@/lib/pricing';

// Configuración de envío gratis
const FREE_SHIPPING_THRESHOLD = 150000;

declare global {
  interface Window {
    MercadoPago?: new (key: string, opts: Record<string, string>) => {
      bricks: () => {
        create: (type: string, container: string, opts: Record<string, unknown>) => Promise<{ unmount: () => void }>;
      };
    };
    paymentBrickController?: { unmount?: () => void };
  }
}

interface ShippingState {
  method: string;
  postalCode: string;
  province: string;
  city: string;
  addressLine: string;
  reference: string;
  cost: number;
  zone: string;
  etaDays: string;
  source: string;
  quoted: boolean;
}

export default function CheckoutPage() {
  // Evitar hydration mismatch en banners condicionales
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { carrito } = useCart();
  // Normalizar carrito una sola vez
  const carritoNormalizado = carrito.map(normalizarCartItem);
  // Centralizar cálculos usando pricing.ts
  const subtotal = calcularSubtotal(carritoNormalizado);
  const router = useRouter();





    // Estado y handler para acción de transferencia (debe ir después de las variables usadas)
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferError, setTransferError] = useState<string | undefined>(undefined);

    const handleTransferConfirm = async () => {
      setTransferLoading(true);
      setTransferError(undefined);
      try {
        const orderData = {
          buyer_name: form.nombre,
          buyer_email: form.email,
          buyer_phone: form.telefono,
          buyer_address: {
            street: shipping.addressLine,
            city: shipping.city,
            province: shipping.province,
            zip: shipping.postalCode,
          },
          items: carrito.map((it) => ({
            product_id: it.id,
            title: it.name,
            variant_id: it.variant_id || null,
            talle: it.talle || '',
            color: it.color || '',
            quantity: it.cantidad,
            unit_price: it.price,
          })),
          subtotal: subtotalCalc,
          shipping_cost: shippingCalc,
          shipping_method: shipping.method,
        };
        const result = await createTransferOrder(orderData);
        router.push(`/transfer-confirmation?orderId=${result.orderId}`);
      } catch (err) {
        setTransferError(err instanceof Error ? err.message : 'Error procesando el pedido');
      } finally {
        setTransferLoading(false);
      }
    };

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    direccion: '',
    telefono: '',
  });

  const [shipping, setShipping] = useState<ShippingState>({
    method: 'correo_argentino',
    postalCode: '',
    province: '',
    city: '',
    addressLine: '',
    reference: '',
    cost: 0,
    zone: '',
    etaDays: '',
    source: '',
    quoted: false,
  });

  // Para debounce del cálculo de envío
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [shippingCalculating, setShippingCalculating] = useState(false);

  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
    const [modo, setModo] = useState<string | null>(null);
  const [paymentMethodSelected, setPaymentMethodSelected] = useState<'mercadopago' | 'transfer' | null>(null);

  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [mpError, setMpError] = useState('');
  const [brickMounted, setBrickMounted] = useState(false);
  const preferenceRequestRef = useRef<Promise<string> | null>(null);
  const mountedRef = useRef(false);
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('access');
    if (token) setModo('logueado');
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'direccion') {
      setShipping((prev) => ({ ...prev, addressLine: e.target.value, quoted: false, cost: 0, zone: '', etaDays: '', source: '' }));
    }
  };

  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShipping((prev) => {
      let next = { ...prev, [name]: value };
      // Si cambia ciudad y el método es concordia_gratis, validar si sigue siendo Concordia
      if (name === 'city' && prev.method === 'concordia_gratis') {
        const newCity = value.trim().toLowerCase();
        if (newCity !== 'concordia') {
          // Forzar a correo_argentino si ya no es Concordia
          next = { ...next, method: 'correo_argentino', cost: 0, quoted: false, zone: '', etaDays: '', source: '' };
        }
      }
      if (name === 'method') {
        if (value === 'retiro_local') {
          next.cost = 0;
          next.quoted = true;
          next.zone = 'local';
          next.etaDays = '0';
          next.source = 'fixed_table';
        } else if (value === 'concordia_gratis') {
          next.cost = 0;
          next.quoted = true;
          next.zone = 'Concordia';
          next.etaDays = '1-2';
          next.source = 'concordia_gratis';
        } else {
          next.cost = 0;
          next.quoted = false;
          next.zone = '';
          next.etaDays = '';
          next.source = '';
        }
      } else if (name !== 'reference') {
        next.quoted = false;
        next.cost = 0;
        next.zone = '';
        next.etaDays = '';
        next.source = '';
      }
      return next;
    });
    setShippingError('');
  };

  const shippingCost = shipping.method === 'correo_argentino' ? Number(shipping.cost || 0) : 0;
  const subtotalCalc = subtotal;
  const shippingCalc = calcularEnvio(shippingCost);
  const originalTotal = calcularTotalOriginal(subtotalCalc, shippingCalc);
  const discount = calcularDescuentoTransferencia(originalTotal);
  const transferTotal = calcularTotalConDescuento(originalTotal);
  // El total actual depende del metodo seleccionado
  const total = paymentMethodSelected === 'transfer' ? transferTotal : originalTotal;
  const buyerReady = Boolean(form.nombre.trim() && form.email.trim() && form.telefono.trim());
  const shippingReady = shipping.method !== 'correo_argentino' || shipping.quoted;
  const paymentReady = buyerReady && shippingReady;

  const buildBuyerAddress = useCallback(() => {
    if (shipping.method !== 'correo_argentino') return form.direccion || 'Retiro en tienda';
    return [shipping.addressLine || form.direccion, shipping.city, shipping.province, shipping.postalCode ? `CP ${shipping.postalCode}` : '']
      .filter(Boolean)
      .join(', ');
  }, [shipping, form.direccion]);

  const buildShippingPayload = useCallback(
    () => ({
      method: shipping.method,
      cost: shipping.method === 'correo_argentino' ? Number(shipping.cost || 0) : 0,
      postalCode: shipping.postalCode,
      province: shipping.province,
      city: shipping.city,
      addressLine: shipping.addressLine || form.direccion,
      reference: shipping.reference,
      phone: form.telefono,
    }),
    [shipping, form.direccion, form.telefono],
  );

  // Nuevo: cálculo automático de envío con debounce
  useEffect(() => {
    // Solo calcular si método es correo_argentino y hay datos suficientes
    if (shipping.method !== 'correo_argentino') return;
    if (!shipping.postalCode || !shipping.city || !shipping.province || !(shipping.addressLine || form.direccion)) {
      setShipping((prev) => ({ ...prev, quoted: false, cost: 0, zone: '', etaDays: '', source: '' }));
      return;
    }
    setShippingCalculating(true);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(async () => {
      try {
        setShippingLoading(true);
        setShippingError('');
        const response = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipping: buildShippingPayload(),
            subtotal: subtotalCalc,
            items: carritoNormalizado.map((it) => ({
              product_id: it.id,
              variant_id: it.variant_id || null,
              talle: it.talle || '',
              color: it.color || '',
              quantity: it.cantidad,
              unit_price: it.price,
            })),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo cotizar el envío');
        const quote = data.shipping || {};
        setShipping((prev) => ({
          ...prev,
          cost: Number(quote.cost || 0),
          zone: quote.zone || '',
          etaDays: quote.etaDays || '',
          source: quote.source || '',
          quoted: true,
        }));
      } catch (err) {
        setShippingError(err instanceof Error ? err.message : 'No se pudo cotizar');
        setShipping((prev) => ({ ...prev, quoted: false, cost: 0, zone: '', etaDays: '', source: '' }));
      } finally {
        setShippingLoading(false);
        setShippingCalculating(false);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipping.postalCode, shipping.city, shipping.province, shipping.addressLine, form.direccion, carrito, shipping.method]);

  // Invalidate shipping quote when cart changes
  useEffect(() => {
    if (shipping.method !== 'correo_argentino') return;
    setShipping((prev) => {
      if (!prev.quoted && Number(prev.cost || 0) === 0) return prev;
      return { ...prev, quoted: false, cost: 0, zone: '', etaDays: '', source: '' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito]);

  // Detectar Concordia automáticamente
  const isConcordia =
    shipping.city.trim().toLowerCase() === 'concordia' ||
    shipping.province.trim().toLowerCase() === 'entre rios' && shipping.city.trim().toLowerCase() === 'concordia';

  // Solo sugerir visualmente el envío gratis si es Concordia (no seleccionar automáticamente)
  // Prefill from dashboard for logged-in users
  useEffect(() => {
    if (modo !== 'logueado' || prefillAppliedRef.current) return;
    const token = localStorage.getItem('access');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/me/dashboard', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        const user = data?.user || {};
        const addresses = Array.isArray(data?.addresses) ? data.addresses : [];
        const primary = addresses.find((addr: Record<string, unknown>) => addr?.is_primary) || null;
        setForm((prev) => ({
          ...prev,
          nombre: prev.nombre || user.nombre || '',
          email: prev.email || user.email || '',
          telefono: prev.telefono || primary?.phone || '',
          direccion: prev.direccion || primary?.street_address || '',
        }));
        if (primary) {
          setShipping((prev) => ({
            ...prev,
            postalCode: prev.postalCode || primary.postal_code || '',
            province: prev.province || primary.province || '',
            city: prev.city || primary.city || '',
            addressLine: prev.addressLine || primary.street_address || '',
            reference: prev.reference || primary.reference || '',
          }));
        }
        prefillAppliedRef.current = true;
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [modo]);

  // Reset brick when cart/shipping changes
  useEffect(() => {
    setPreferenceId(null);
    setBrickMounted(false);
    setMpError('');
    mountedRef.current = false;
    preferenceRequestRef.current = null;
    try { window.paymentBrickController?.unmount?.(); } catch { /* ignore */ }
  }, [carrito, shipping.method, shipping.cost]);

    useEffect(() => () => {
    try { window.paymentBrickController?.unmount?.(); } catch { /* ignore */ }
  }, []);

  // Reset brick state when payment method changes
  useEffect(() => {
    if (paymentMethodSelected !== 'mercadopago') {
      mountedRef.current = false;
      setBrickMounted(false);
      try { window.paymentBrickController?.unmount?.(); } catch { /* ignore */ }
    }
  }, [paymentMethodSelected]);

    // Mount payment brick
  useEffect(() => {
    if (modo !== 'invitado' && modo !== 'logueado') return;
    if (paymentMethodSelected !== 'mercadopago') return;
    if (brickMounted || mountedRef.current || !paymentReady) return;
    if (!window.MercadoPago) return;
    const container = document.getElementById('paymentBrick_container');
    if (!container) return;

    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '', { locale: 'es-AR' });
    const bricks = mp.bricks();

    const ensurePreference = async (): Promise<string> => {
      if (preferenceId) return preferenceId;
      if (preferenceRequestRef.current) return preferenceRequestRef.current;

      const requestPromise = (async () => {
        const response = await fetch('/api/payments/preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: carritoNormalizado.map((it) => ({
              product_id: it.id,
              title: it.name,
              variant_id: it.variant_id ?? null,
              talle: it.talle ?? '',
              color: it.color ?? '',
              quantity: it.cantidad,
              unit_price: it.price,
            })),
            buyer: { name: form.nombre, email: form.email, address: buildBuyerAddress(), phone: form.telefono },
            shipping: buildShippingPayload(),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo crear preferencia');
        setPreferenceId(data.preferenceId);
        return data.preferenceId as string;
      })();

      preferenceRequestRef.current = requestPromise;
      try {
        return await requestPromise;
      } catch (e) {
        preferenceRequestRef.current = null;
        throw e;
      }
    };

    const mountPayment = async () => {
      try {
        mountedRef.current = true;
        const prefId = await ensurePreference();

        const payerData: Record<string, string> = {};
        if (form.email) payerData.email = form.email;
        if (form.nombre) {
          const parts = form.nombre.trim().split(/\s+/);
          payerData.firstName = parts[0];
          if (parts.length > 1) payerData.lastName = parts.slice(1).join(' ');
        }

        window.paymentBrickController = await bricks.create('payment', 'paymentBrick_container', {
          initialization: {
            amount: total,
            preferenceId: prefId,
            ...(Object.keys(payerData).length > 0 && { payer: payerData }),
          },
          customization: {
            paymentMethods: { ticket: 'all', creditCard: 'all', prepaidCard: 'all', debitCard: 'all', mercadoPago: 'all' },
            visual: { hideFormTitle: true },
          },
          callbacks: {
            onReady: () => setBrickMounted(true),
            onSubmit: async (formData: unknown) => {
              try {
                const response = await fetch('/api/payments/charge', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    items: carritoNormalizado.map((it) => ({
                      product_id: it.id,
                      title: it.name,
                      variant_id: it.variant_id || null,
                      talle: it.talle || '',
                      color: it.color || '',
                      quantity: it.cantidad,
                      unit_price: it.price,
                    })),
                    buyer: { name: form.nombre, email: form.email, address: buildBuyerAddress(), phone: form.telefono },
                    shipping: buildShippingPayload(),
                    formData,
                  }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Error procesando el pago');
                if (data.initPoint) {
                  window.location.href = data.initPoint;
                  return;
                }
                router.push('/confirmation');
              } catch (e) {
                setMpError(e instanceof Error ? e.message : 'Error procesando el pago');
                throw e;
              }
            },
            onError: (error: { message?: string }) => setMpError(error?.message || 'Error en Payment Brick'),
          },
        });
      } catch (e) {
        mountedRef.current = false;
        setMpError(e instanceof Error ? e.message : 'Error inicializando el formulario de pago');
      }
    };

    mountPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, paymentMethodSelected, brickMounted, paymentReady, total]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <h1 className="font-display text-2xl md:text-3xl text-neutral-900 text-center mb-8">Finalizá tu compra</h1>

      {modo === null && (
        <div className="mb-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          <button className="border border-neutral-900 text-neutral-900 px-6 py-2.5 text-sm uppercase tracking-wider hover:bg-neutral-50 transition-colors" onClick={() => setModo('invitado')}>
            Comprar como invitado
          </button>
          <button className="border border-neutral-300 text-neutral-700 px-6 py-2.5 text-sm uppercase tracking-wider hover:bg-neutral-50 transition-colors" onClick={() => router.push('/login?from=/checkout')}>
            Iniciar sesión
          </button>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        {(modo === 'invitado' || modo === 'logueado') && (
          <div className="bg-neutral-50 p-6 border border-neutral-100 space-y-6">
            {/* Datos del comprador */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Datos del comprador</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Nombre y apellido</label>
                  <input type="text" name="nombre" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={form.nombre} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Email</label>
                  <input type="email" name="email" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={form.email} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Teléfono</label>
                  <input type="text" name="telefono" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={form.telefono} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Dirección de envío SIEMPRE visible */}
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Dirección de envío</h3>
              <div className="mb-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Código postal</label>
                  <input type="text" name="postalCode" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={shipping.postalCode} onChange={handleShippingChange} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Provincia</label>
                  <input type="text" name="province" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={shipping.province} onChange={handleShippingChange} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Ciudad</label>
                  <input type="text" name="city" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={shipping.city} onChange={handleShippingChange} />
                </div>
              </div>
              <div className="mb-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Calle y número</label>
                <input type="text" name="addressLine" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={shipping.addressLine} onChange={handleShippingChange} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Referencia (opcional)</label>
                <input type="text" name="reference" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={shipping.reference} onChange={handleShippingChange} placeholder="Ej: Timbre 2" />
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Método de envío</h3>
              {/* Sugerencia visual si es Concordia */}
              {isConcordia && (
                <div className="mb-2 p-3 rounded border border-green-300 bg-green-50 text-green-800 font-medium text-sm">
                  ¡Tenés disponible <span className="font-bold">Envío gratis a Concordia</span>! Seleccionalo abajo si querés aprovecharlo.
                </div>
              )}
              <div className="space-y-2">
                {/* Correo Argentino */}
                <label className="flex items-start gap-3 border border-neutral-200 p-4 cursor-pointer hover:bg-white transition-colors">
                  <input type="radio" name="method" value="correo_argentino" checked={shipping.method === 'correo_argentino'} onChange={handleShippingChange} className="mt-1" />
                  <div>
                    <div className="font-semibold text-sm">Correo Argentino</div>
                    <div className="text-xs text-neutral-500">Envío a domicilio en todo el país. Costo según dirección.</div>
                  </div>
                </label>
                {/* Envío gratis a Concordia */}
                <label className="flex items-start gap-3 border border-neutral-200 p-4 cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="method"
                    value="concordia_gratis"
                    checked={shipping.method === 'concordia_gratis'}
                    onChange={handleShippingChange}
                    className="mt-1"
                    disabled={!isConcordia}
                  />
                  <div>
                    <div className="font-semibold text-sm">Envío gratis a Concordia</div>
                    <div className="text-xs text-neutral-500">Entrega a domicilio</div>
                    <div className="text-xs" style={{ color: '#25D366' }}>Coordinamos por Whatsapp</div>
                    {!isConcordia && (
                      <div className="text-xs text-neutral-400">Disponible solo en Concordia</div>
                    )}
                  </div>
                </label>
                {/* Retiro en tienda */}
                <label className="flex items-start gap-3 border border-neutral-200 p-4 cursor-pointer hover:bg-white transition-colors">
                  <input type="radio" name="method" value="retiro_local" checked={shipping.method === 'retiro_local'} onChange={handleShippingChange} className="mt-1" />
                  <div>
                    <div className="font-semibold text-sm">Retiro en tienda</div>
                    <div className="text-xs text-neutral-500">Sin costo de envío, Retirá por nuestro local.</div>
                  </div>
                </label>
              </div>
              {/* Feedback de envío en tiempo real */}
              <div className="mt-4">
                <div className="bg-neutral-100 text-neutral-800 p-3 text-sm border border-neutral-200">
                  Envío: {shippingCalculating || shippingLoading ? 'Calculando...' : formatoPrecio(shipping.cost)} | Zona: {shipping.zone || 'General'} | Entrega estimada: {shipping.etaDays || '-'} días
                </div>
                {shippingError && <p className="text-red-500 text-sm mt-2">{shippingError}</p>}
              </div>
            </div>

            {/* Totals summary */}
            <div className="bg-white border border-neutral-200 p-4">
              <div className="flex justify-between text-sm text-neutral-500">
                <span>Subtotal</span>
                <span>{formatoPrecio(subtotalCalc)}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-500 mt-1">
                <span>Envío</span>
                <span>{formatoPrecio(shippingCalc)}</span>
              </div>
                {mounted && (
                  <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-neutral-100">
                    <span>Total a pagar</span>
                    <span>{formatoPrecio(total)}</span>
                  </div>
                )}
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Método de pago</h3>
              {!paymentReady && (
                <div className="border border-neutral-200 p-4 bg-white text-neutral-500 text-sm">
                  {!buyerReady
                    ? 'Completá nombre, email y teléfono para habilitar el pago.'
                    : 'Completá tus datos y calculá el envío para habilitar el pago.'}
                </div>
              )}

              {mpError && <p className="text-red-500 text-sm mt-2">{mpError}</p>}

              {/* Selección de método de pago */}
              {paymentReady && !paymentMethodSelected && (
                <div className="space-y-3">
                  <button
                    onClick={() => setPaymentMethodSelected('mercadopago')}
                    className="w-full border border-neutral-900 bg-neutral-900 text-white px-4 py-4 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">Pagar con Mercado Pago</span>
                      <span className="text-xs bg-white/20 px-2 py-1 rounded">Tarjetas, efectivo, etc.</span>
                    </div>
                    <p className="text-sm text-neutral-300 mt-1 text-left">
                      Paga de forma inmediata con tarjeta de crédito, débito o efectivo
                    </p>
                  </button>

                  <button
                    onClick={() => setPaymentMethodSelected('transfer')}
                    className="w-full border border-green-600 text-green-700 px-4 py-4 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">Pagar con transferencia bancaria</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{TRANSFER_DISCOUNT_PERCENT}% OFF</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1 text-left">
                      Ahorra {formatoPrecio(discount)} - Total: {formatoPrecio(transferTotal)}
                    </p>
                  </button>
                </div>
              )}

              {/* Opción seleccionada: Mercado Pago */}
              {paymentReady && paymentMethodSelected === 'mercadopago' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Pago con Mercado Pago</h4>
                    <button
                      onClick={() => setPaymentMethodSelected(null)}
                      className="text-sm text-neutral-600 hover:underline"
                    >
                      Cambiar método de pago
                    </button>
                  </div>
                  {mpError && <p className="text-red-500 text-sm mb-2">{mpError}</p>}
                  {!brickMounted && !mpError && (
                    <div className="flex items-center justify-center py-8 text-neutral-500">
                      <svg className="animate-spin h-5 w-5 mr-3 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cargando formulario de pago...
                    </div>
                  )}
                  {!window.MercadoPago && (
                    <p className="text-amber-600 text-sm mb-2">
                      Error: No se pudo cargar el SDK de Mercado Pago. Por favor, recarga la página.
                    </p>
                  )}
                  <div id="paymentBrick_container" />
                </div>
              )}

              {/* Opción seleccionada: Transferencia */}
              {paymentReady && paymentMethodSelected === 'transfer' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-green-800">Pago por transferencia bancaria</h4>
                    <button
                      onClick={() => setPaymentMethodSelected(null)}
                      className="text-sm text-green-700 hover:underline"
                    >
                      Cambiar método de pago
                    </button>
                  </div>
                  <TransferCheckout
                    subtotal={subtotalCalc}
                    shippingCost={shippingCalc}
                    originalTotal={originalTotal}
                    discount={discount}
                    totalConDescuento={transferTotal}
                    onCancel={() => setPaymentMethodSelected(null)}
                    onConfirm={handleTransferConfirm}
                    loading={transferLoading}
                    error={transferError}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        

        {/* Order summary */}
        <div className="bg-neutral-50 p-6 border border-neutral-100 xl:sticky xl:top-24">
          <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Resumen de compra</h3>
          <div className="space-y-3 mb-4">
            {mounted && carritoNormalizado.map((item) => (
              <div key={`${item.id}-${item.talle ?? ''}-${item.color ?? ''}`} className="flex items-start gap-3">
                <div className="relative w-14 h-14 overflow-hidden flex-shrink-0">
                  <Image src={item.img || ''} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm break-words">{item.name}</div>
                  <div className="text-sm text-neutral-500 break-words">Talle: {formatTalle(item.talle) ?? '-'} | Color: {(item.color ?? '').trim() || '-'}</div>
                  <div className="text-sm text-neutral-400">x{item.cantidad}</div>
                </div>
                <div className="font-semibold text-sm text-right">{formatoPrecio(item.price * item.cantidad)}</div>
              </div>
            ))}
          </div>
          <div className="text-right space-y-1 border-t border-neutral-200 pt-3">
            <div className="text-sm text-neutral-500">Subtotal: {mounted ? formatoPrecio(subtotalCalc) : ''}</div>
            <div className="text-sm text-neutral-500">Envío: {mounted ? formatoPrecio(shippingCalc) : ''}</div>
            {mounted && paymentMethodSelected === 'transfer' && (
              <>
                <div className="text-sm text-neutral-400 line-through">Total: {formatoPrecio(originalTotal)}</div>
                <div className="text-sm text-green-600">Descuento ({TRANSFER_DISCOUNT_PERCENT}%): -{formatoPrecio(discount)}</div>
              </>
            )}
            <div className="font-semibold text-lg">Total: {mounted ? formatoPrecio(total) : ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
