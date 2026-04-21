'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/lib/api';
import { formatoPrecio, formatDate, formatTalle, composeAddress } from '@/lib/utils';
import type { AddressRow, OrderRow, DashboardData } from '@/types';

const blankAddress = {
  recipient_name: '',
  phone: '',
  street_address: '',
  city: '',
  province: '',
  postal_code: '',
  reference: '',
};

export default function MiCuentaPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<DashboardData>({ user: null, addresses: [], purchases: [] });

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [addrMode, setAddrMode] = useState<'edit' | 'create' | null>(null);
  const [addrForm, setAddrForm] = useState(blankAddress);
  const [savingAddr, setSavingAddr] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
  }, [user, router]);

  const loadPanel = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/me/dashboard');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar tu panel');
      setPanel(data || { user: null, addresses: [], purchases: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPanel(); /* eslint-disable-next-line */ }, []);

  const primaryAddress = useMemo(
    () => panel.addresses?.find((a) => a.is_primary) || panel.addresses?.[0] || null,
    [panel.addresses],
  );

  const secondaryAddresses = useMemo(
    () => (panel.addresses || []).filter(
      (a) => (!primaryAddress || a.id !== primaryAddress.id) && a.source === 'profile',
    ),
    [panel.addresses, primaryAddress],
  );

  // Order detail
  const openDetail = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setOrderDetail(null);
    setLoadingDetail(true);
    try {
      const res = await authFetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo cargar la orden');
      setOrderDetail(data.order || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando detalle');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => { setSelectedOrderId(null); setOrderDetail(null); };

  const currentOrderIndex = (panel.purchases || []).findIndex((o) => o.id === selectedOrderId);
  const canGoPrev = currentOrderIndex > 0;
  const canGoNext = currentOrderIndex >= 0 && currentOrderIndex < (panel.purchases || []).length - 1;
  const goToPrevOrder = () => { if (canGoPrev) openDetail(panel.purchases[currentOrderIndex - 1].id); };
  const goToNextOrder = () => { if (canGoNext) openDetail(panel.purchases[currentOrderIndex + 1].id); };

  // Address CRUD
  const startEdit = () => {
    if (!primaryAddress) return;
    setAddrForm({
      recipient_name: primaryAddress.recipient_name || '',
      phone: primaryAddress.phone || '',
      street_address: primaryAddress.street_address || '',
      city: primaryAddress.city || '',
      province: primaryAddress.province || '',
      postal_code: primaryAddress.postal_code || '',
      reference: primaryAddress.reference || primaryAddress.notes || '',
    });
    setAddrMode('edit');
  };

  const startCreate = () => { setAddrForm({ ...blankAddress }); setAddrMode('create'); };
  const cancelAddr = () => { setAddrMode(null); setAddrForm(blankAddress); };

  const handleAddr = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddrForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const saveAddr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrForm.street_address.trim() || !addrForm.city.trim() || !addrForm.province.trim() || !addrForm.postal_code.trim()) {
      setError('Completá dirección, ciudad, provincia y código postal');
      return;
    }
    setSavingAddr(true);
    setError('');
    try {
      const isEdit = addrMode === 'edit' && primaryAddress;
      const url = isEdit ? `/api/me/addresses/${primaryAddress.id}` : '/api/me/addresses';
      const method = isEdit ? 'PUT' : 'POST';
      const composedAddr = composeAddress(addrForm);
      const body = {
        ...addrForm,
        address: composedAddr,
        notes: addrForm.reference || null,
        is_primary: isEdit ? primaryAddress.is_primary : !panel.addresses.length,
      };
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
      cancelAddr();
      await loadPanel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando dirección');
    } finally {
      setSavingAddr(false);
    }
  };

  const markAsPrimary = async (addressId: number) => {
    setSavingAddr(true);
    setError('');
    try {
      const res = await authFetch(`/api/me/addresses/${addressId}/primary`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo marcar principal');
      await loadPanel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingAddr(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">

      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-2">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-neutral-900">Mi cuenta</h1>
          <div className="mt-2">
            <button
              type="button"
              className="text-sm text-blue-700 hover:underline"
              onClick={() => setShowChangePassword((v) => !v)}
            >
              {showChangePassword ? 'Ocultar cambio de contraseña' : 'Cambiar contraseña'}
            </button>
          </div>
        </div>
        <Link href="/productos" className="border border-neutral-900 text-neutral-900 px-4 py-2  text-sm hover:bg-neutral-100">
          Seguir comprando
        </Link>
      </div>

      {loading && <p className="text-neutral-500">Cargando...</p>}
      {error && <div className="bg-red-50 text-red-700 p-3  mb-4">{error}</div>}

      {/* Formulario de cambio de contraseña */}
      {showChangePassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          id="cambiar-password-form"
          onClick={e => {
            if (e.target === e.currentTarget) setShowChangePassword(false);
          }}
        >
          <div className="bg-white rounded shadow-lg max-w-md w-full p-6 relative animate-fade-in" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="absolute top-2 right-2 text-2xl text-neutral-400 hover:text-neutral-700"
              aria-label="Cerrar"
              onClick={() => setShowChangePassword(false)}
            >
              &times;
            </button>
            <ChangePasswordForm />
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8 items-start">
          {/* Left column */}
          <div className="space-y-6">
            {/* User data */}
            <div className="border border-neutral-200 overflow-hidden">
              <div className="bg-neutral-50 px-4 py-3 font-semibold">Mis datos</div>
              <div className="divide-y">
                <div className="px-4 py-3"><span className="block text-xs text-neutral-500">Nombre</span>{panel.user?.nombre || '-'}</div>
                <div className="px-4 py-3"><span className="block text-xs text-neutral-500">Email</span>{panel.user?.email || '-'}</div>
                <div className="px-4 py-3">
                  <span className="block text-xs text-neutral-500">Verificación</span>
                  {panel.user?.email_verified ? <span className="text-green-600">✔ Verificado</span> : <span className="text-amber-600">⏳ Pendiente</span>}
                </div>
                <div className="px-4 py-3"><span className="block text-xs text-neutral-500">Cliente desde</span>{formatDate(panel.user?.created_at)}</div>
              </div>
            </div>

            {/* Primary address */}
            <div className="border border-neutral-200 overflow-hidden">
              <div className="bg-neutral-50 px-4 py-3 flex justify-between items-center">
                <span className="font-semibold">Dirección principal</span>
                <div className="flex gap-2">
                  {primaryAddress && !addrMode && (
                    <button className="text-sm border rounded px-3 py-1 hover:bg-neutral-100" onClick={startEdit}>Editar</button>
                  )}
                  {!addrMode && (
                    <button className="text-sm border border-neutral-900 rounded px-3 py-1 hover:bg-neutral-100" onClick={startCreate}>Agregar nueva</button>
                  )}
                </div>
              </div>
              <div className="p-4">
                {!addrMode && primaryAddress && (
                  <div className="bg-neutral-50 border  p-4">
                    <div className="font-medium">{primaryAddress.recipient_name || panel.user?.nombre || 'Sin nombre'}</div>
                    <div className="text-sm text-neutral-600">{composeAddress(primaryAddress)}</div>
                    {primaryAddress.phone && <div className="text-sm text-neutral-500 mt-1">Tel: {primaryAddress.phone}</div>}
                    {(primaryAddress.reference || primaryAddress.notes) && <div className="text-sm text-neutral-500 mt-1">{primaryAddress.reference || primaryAddress.notes}</div>}
                  </div>
                )}
                {!addrMode && !primaryAddress && <p className="text-neutral-500">Todavía no tenés una dirección cargada.</p>}

                {!addrMode && secondaryAddresses.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-neutral-500">Direcciones secundarias</p>
                    {secondaryAddresses.map((addr) => (
                      <div key={addr.id} className="border  p-3">
                        <div className="text-sm font-medium">{addr.recipient_name || panel.user?.nombre || 'Sin nombre'}</div>
                        <div className="text-sm text-neutral-500">{composeAddress(addr)}</div>
                        <button className="text-neutral-900 underline text-sm mt-1 hover:underline" onClick={() => markAsPrimary(addr.id)} disabled={savingAddr}>
                          Marcar como principal
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {addrMode && (
                  <form onSubmit={saveAddr} className="space-y-3">
                    <p className="font-medium">{addrMode === 'edit' ? 'Editar dirección' : 'Nueva dirección'}</p>
                    {(['recipient_name', 'phone', 'street_address', 'city', 'province', 'postal_code', 'reference'] as const).map((field) => (
                      <div key={field}>
                        <label className="block text-sm mb-1 capitalize">{field.replace('_', ' ')}</label>
                        <input className="w-full border  px-3 py-1.5 text-sm" name={field} value={addrForm[field]} onChange={handleAddr} />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button type="submit" className="bg-neutral-900 text-white px-4 py-1.5  text-sm hover:bg-neutral-800" disabled={savingAddr}>
                        {savingAddr ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button type="button" className="border px-4 py-1.5  text-sm hover:bg-neutral-100" onClick={cancelAddr}>Cancelar</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Right column - purchases */}
          <div className="border border-neutral-200 overflow-hidden">
            <div className="bg-neutral-50 px-4 py-3 font-semibold">Mis compras</div>
            <div className="p-4">
              {!panel.purchases?.length ? (
                <div className="text-center py-10 text-neutral-500">
                  <p className="mb-4">Aún no tenés compras registradas.</p>
                  <Link href="/productos" className="bg-neutral-900 text-white px-4 py-2  text-sm">Explorar productos</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {panel.purchases.map((order) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const firstName = items[0]?.name || 'Producto';
                    const extra = items.length - 1;
                    return (
                      <button
                        key={order.id}
                        className="w-full text-left border  p-4 hover:bg-neutral-50 transition"
                        onClick={() => openDetail(order.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">{firstName}</span>
                            {extra > 0 && <span className="ml-2 bg-neutral-200 text-neutral-700 text-xs px-2 py-0.5 rounded-full">+{extra}</span>}
                            <div className="text-sm text-neutral-500 mt-1">{formatDate(order.created_at)} · Orden #{order.id}</div>
                          </div>
                          <span className="text-neutral-400">›</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white border-neutral-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">Orden #{selectedOrderId}</h3>
              <div className="flex items-center gap-2">
                <button className="border rounded px-3 py-1 text-sm disabled:opacity-40" onClick={goToPrevOrder} disabled={!canGoPrev || loadingDetail}>Anterior</button>
                <button className="border rounded px-3 py-1 text-sm disabled:opacity-40" onClick={goToNextOrder} disabled={!canGoNext || loadingDetail}>Siguiente</button>
                <button className="text-xl text-neutral-500 hover:text-neutral-800 ml-2" onClick={closeDetail}>&times;</button>
              </div>
            </div>
            <div className="p-4">
              {loadingDetail && <p className="text-center py-8 text-neutral-500">Cargando detalles...</p>}
              {!loadingDetail && !orderDetail && <p className="text-center py-8 text-neutral-500">No se pudo cargar la orden.</p>}
              {!loadingDetail && orderDetail && (
                <>
                  <h4 className="font-medium mb-3">Productos</h4>
                  {(orderDetail.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between border-b py-3">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-neutral-500">
                          {item.quantity} × {formatoPrecio(item.unit_price)}
                          {(item.color || formatTalle(item.talle)) && (
                            <span className="ml-1">
                              {item.color && <>Color: {item.color}</>}
                              {item.color && formatTalle(item.talle) && ' | '}
                              {formatTalle(item.talle) && <>Talle: {formatTalle(item.talle)}</>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="self-center font-medium">{formatoPrecio(item.unit_price * item.quantity)}</div>
                    </div>
                  ))}

                  {/* Totales mejorados */}
                  <div className="bg-neutral-50  p-4 mt-4 space-y-1">
                    {/* Subtotal */}
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatoPrecio(orderDetail.original_amount !== undefined && orderDetail.original_amount !== null
                        ? orderDetail.original_amount
                        : (orderDetail.items || []).reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 1), 0)
                      )}</span>
                    </div>
                    {/* Envío */}
                    {orderDetail.shipping_cost != null && (
                      <div className="flex justify-between text-sm">
                        <span>Envío{orderDetail.shipping_method ? ` (${orderDetail.shipping_method})` : ''}</span>
                        <span>{formatoPrecio(orderDetail.shipping_cost)}</span>
                      </div>
                    )}
                    {/* Total original tachado si hay descuento */}
                    {(orderDetail.discount_applied !== undefined && orderDetail.discount_applied !== null && orderDetail.discount_applied > 0) && (
                      <div className="flex justify-between text-sm">
                        <span>Total:</span>
                        <span className="line-through text-neutral-500">{formatoPrecio(orderDetail.original_amount ?? 0)}</span>
                      </div>
                    )}
                    {/* Descuento con porcentaje si es 20% */}
                    {(orderDetail.discount_applied !== undefined && orderDetail.discount_applied !== null && orderDetail.discount_applied > 0) && (
                      <div className="flex justify-between text-sm">
                        <span>Descuento{orderDetail.original_amount && Math.abs(orderDetail.discount_applied / orderDetail.original_amount - 0.2) < 0.01 ? ' (20%)' : ''}:</span>
                        <span className="text-green-700">- {formatoPrecio(orderDetail.discount_applied)}</span>
                      </div>
                    )}
                    {/* Total final */}
                    <div className="flex justify-between font-semibold border-t pt-2 text-lg">
                      <span>Total</span>
                      <span>{formatoPrecio(orderDetail.total_amount)}</span>
                    </div>
                    {/* Método de pago */}
                    <div className="flex justify-between text-sm mt-2">
                      <span>Método de pago</span>
                      <span>{orderDetail.mp_payment_status === 'transfer' ? 'Transferencia' : orderDetail.mp_payment_status === 'paid' ? 'Mercado Pago' : '---'}</span>
                    </div>
                  </div>

                  {/* Dirección de envío mejorada */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Dirección de envío</h4>
                    <div className="border  p-3 bg-neutral-50">
                      {(() => {
                        let addr = orderDetail.buyer_address;
                        let parsed = null;
                        if (typeof addr === 'string') {
                          try { parsed = JSON.parse(addr); } catch {}
                        } else if (typeof addr === 'object' && addr) {
                          parsed = addr;
                        }
                        if (parsed) {
                          return <>
                            <div className="font-medium">{orderDetail.buyer_name || panel.user?.nombre || '-'}</div>
                            <div>{parsed.street || parsed.street_address}{parsed.street || parsed.street_address ? ', ' : ''}{parsed.city}{parsed.city ? ', ' : ''}{parsed.province}{parsed.zip || parsed.postal_code ? ' (' + (parsed.zip || parsed.postal_code) + ')' : ''}</div>
                            {parsed.phone && <div className="text-sm text-neutral-500 mt-1">Tel: {parsed.phone}</div>}
                            {parsed.reference && <div className="text-sm text-neutral-500 mt-1">{parsed.reference}</div>}
                          </>;
                        } else {
                          return <>
                            <div className="font-medium">{orderDetail.buyer_name || panel.user?.nombre || '-'}</div>
                            <div>{addr || 'Sin dirección registrada'}</div>
                            {orderDetail.buyer_phone && <div className="text-sm text-neutral-500 mt-1">Tel: {orderDetail.buyer_phone}</div>}
                          </>;
                        }
                      })()}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Estado</h4>
                    <span className="bg-neutral-100 text-neutral-800 px-3 py-1 rounded-full text-sm">{orderDetail.status || 'pendiente'}</span>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t">
              <button className="bg-neutral-900 text-white px-4 py-2  text-sm" onClick={closeDetail}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
