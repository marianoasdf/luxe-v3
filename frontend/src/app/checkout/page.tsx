'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { formatoPrecio } from '@/lib/utils';

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
  const { carrito, total: itemsSubtotal } = useCart();
  const router = useRouter();

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

  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [modo, setModo] = useState<string | null>(null);

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
      const next = { ...prev, [name]: value };
      if (name === 'method') {
        if (value === 'retiro_local') {
          next.cost = 0;
          next.quoted = true;
          next.zone = 'local';
          next.etaDays = '0';
          next.source = 'fixed_table';
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
  const total = itemsSubtotal + shippingCost;
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
    }),
    [shipping, form.direccion],
  );

  const quoteShipping = async () => {
    if (shipping.method === 'retiro_local') {
      setShipping((prev) => ({ ...prev, cost: 0, quoted: true, zone: 'local', etaDays: '0', source: 'fixed_table' }));
      setShippingError('');
      return;
    }
    if (!shipping.postalCode || !shipping.city || !shipping.province || !(shipping.addressLine || form.direccion)) {
      setShippingError('Completá dirección, ciudad, provincia y código postal para cotizar.');
      return;
    }
    try {
      setShippingLoading(true);
      setShippingError('');
      const response = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping: buildShippingPayload(),
          subtotal: itemsSubtotal,
          items: carrito.map((it) => ({
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
    } finally {
      setShippingLoading(false);
    }
  };

  // Invalidate shipping quote when cart changes
  useEffect(() => {
    if (shipping.method !== 'correo_argentino') return;
    setShipping((prev) => {
      if (!prev.quoted && Number(prev.cost || 0) === 0) return prev;
      return { ...prev, quoted: false, cost: 0, zone: '', etaDays: '', source: '' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito]);

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

  // Mount payment brick
  useEffect(() => {
    if (modo !== 'invitado' && modo !== 'logueado') return;
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
            items: carrito.map((it) => ({
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
                    items: carrito.map((it) => ({
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
  }, [modo, brickMounted, paymentReady, total]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <h1 className="font-display text-2xl md:text-3xl text-neutral-900 text-center mb-8">Finalizá tu compra</h1>

      {modo === null && (
        <div className="flex justify-center gap-4 mb-8">
          <button className="border border-neutral-900 text-neutral-900 px-6 py-2.5 text-sm uppercase tracking-wider hover:bg-neutral-50 transition-colors" onClick={() => setModo('invitado')}>
            Comprar como invitado
          </button>
          <button className="border border-neutral-300 text-neutral-700 px-6 py-2.5 text-sm uppercase tracking-wider hover:bg-neutral-50 transition-colors" onClick={() => router.push('/login?from=/checkout')}>
            Iniciar sesión
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {(modo === 'invitado' || modo === 'logueado') && (
          <div className="bg-neutral-50 p-6 border border-neutral-100 space-y-6">
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
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Dirección (calle y número)</label>
                  <input type="text" name="direccion" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={form.direccion} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Teléfono</label>
                  <input type="text" name="telefono" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={form.telefono} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Método de envío</h3>
              <div className="space-y-2">
                <label className="flex items-start gap-3 border border-neutral-200 p-4 cursor-pointer hover:bg-white transition-colors">
                  <input type="radio" name="method" value="correo_argentino" checked={shipping.method === 'correo_argentino'} onChange={handleShippingChange} className="mt-1" />
                  <div>
                    <div className="font-medium text-sm">Correo Argentino - envío a domicilio</div>
                    <div className="text-sm text-neutral-500">Cotización por código postal</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 border border-neutral-200 p-4 cursor-pointer hover:bg-white transition-colors">
                  <input type="radio" name="method" value="retiro_local" checked={shipping.method === 'retiro_local'} onChange={handleShippingChange} className="mt-1" />
                  <div>
                    <div className="font-medium text-sm">Retiro en tienda</div>
                    <div className="text-sm text-neutral-500">Sin costo de envío</div>
                  </div>
                </label>
              </div>

              {shipping.method === 'correo_argentino' && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
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
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Referencia (opcional)</label>
                    <input type="text" name="reference" className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" value={shipping.reference} onChange={handleShippingChange} placeholder="Ej: Timbre 2" />
                  </div>
                  <button
                    type="button"
                    className="w-full border border-neutral-900 text-neutral-900 py-2.5 text-sm uppercase tracking-wider hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50"
                    disabled={shippingLoading}
                    onClick={quoteShipping}
                  >
                    {shippingLoading ? 'Cotizando envío...' : 'Calcular envío y habilitar pago'}
                  </button>
                  {shipping.quoted && (
                    <div className="bg-neutral-100 text-neutral-800 p-3 text-sm border border-neutral-200">
                      Envío: {formatoPrecio(shipping.cost)} | Zona: {shipping.zone || 'General'} | Entrega estimada: {shipping.etaDays || '-'} días
                      <br />
                      <strong>Total actualizado: {formatoPrecio(total)}</strong>
                    </div>
                  )}
                </div>
              )}
              {shippingError && <p className="text-red-500 text-sm mt-2">{shippingError}</p>}
            </div>

            {/* Totals summary */}
            <div className="bg-white border border-neutral-200 p-4">
              <div className="flex justify-between text-sm text-neutral-500">
                <span>Subtotal</span>
                <span>{formatoPrecio(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-500 mt-1">
                <span>Envío</span>
                <span>{formatoPrecio(shippingCost)}</span>
              </div>
              <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-neutral-100">
                <span>Total a pagar</span>
                <span>{formatoPrecio(total)}</span>
              </div>
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
              {paymentReady && <div id="paymentBrick_container" />}
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-neutral-50 p-6 border border-neutral-100">
          <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Resumen de compra</h3>
          <div className="space-y-3 mb-4">
            {carrito.map((item) => (
              <div key={`${item.id}-${item.talle || ''}-${item.color || ''}`} className="flex items-center gap-3">
                <div className="relative w-14 h-14 overflow-hidden flex-shrink-0">
                  <Image src={item.img} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="text-sm text-neutral-500">Talle: {item.talle} | Color: {item.color}</div>
                  <div className="text-sm text-neutral-400">x{item.cantidad}</div>
                </div>
                <div className="font-semibold text-sm">{formatoPrecio(item.price * item.cantidad)}</div>
              </div>
            ))}
          </div>
          <div className="text-right space-y-1 border-t border-neutral-200 pt-3">
            <div className="text-sm text-neutral-500">Subtotal: {formatoPrecio(itemsSubtotal)}</div>
            <div className="text-sm text-neutral-500">Envío: {formatoPrecio(shippingCost)}</div>
            <div className="font-semibold text-lg">Total: {formatoPrecio(total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
