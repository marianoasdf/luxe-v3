'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/api';
import { formatoPrecio, formatDate, composeAddress } from '@/lib/utils';

function useAdminSecret(): [string, (s: string) => void] {
  const [secret, setSecret] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('ADMIN_SECRET') || '' : '',
  );
  useEffect(() => { sessionStorage.setItem('ADMIN_SECRET', secret || ''); }, [secret]);
  return [secret, setSecret];
}

interface OrderItem {
  name: string;
  variant_sku?: string;
  variant_label?: string;
  quantity: number;
  unit_price: number;
}

interface OrderRow {
  id: number;
  user_id?: number;
  buyer_email?: string; // backend
  buyer_phone?: string; // backend, para WhatsApp y mostrar teléfono
  email?: string; // frontend mapping
  total_amount?: number; // backend
  total?: number; // frontend mapping
  currency?: string;
  status: string;
  shipping_method?: string; // backend
  envio_tipo?: string; // frontend mapping
  envio_estado?: string;
  envio_tracking?: string;
  envio_label_url?: string;
  envio_costo?: number;
  envio_estimacion?: string;
  created_at: string;
  payment_id?: string;
  payment_method?: string;
  original_amount?: number;
  discount_applied?: number;
  items?: OrderItem[];
  shipping_address?: Record<string, string>;
  buyer?: Record<string, string>;
}

export default function AdminEnviosPage() {
  const [secret, setSecret] = useAdminSecret();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...(secret ? { 'x-admin-secret': secret } : {}) }),
    [secret],
  );

  const fetchOrders = async () => {
    if (!secret) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/orders', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error cargando ordenes');
      // Mapear datos para asegurar consistencia y evitar NaN/null
      const mapped = (data.orders || []).map((o: any) => {
        // Parsear shipping_address desde buyer_address si es string
        let shipping_address = o.shipping_address || o.buyer_address || {};
        if (typeof shipping_address === 'string') {
          try {
            shipping_address = JSON.parse(shipping_address);
          } catch { shipping_address = {}; }
        }
        return {
          ...o,
          email: o.email || o.buyer_email || '-',
          total: typeof o.total === 'number' ? o.total : (typeof o.total_amount === 'number' ? o.total_amount : 0),
          envio_tipo: o.envio_tipo || o.shipping_method || '-',
          shipping_address,
        };
      });
      setOrders(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); /* eslint-disable-next-line */ }, [secret]);

  const genLabel = async (orderId: number) => {
    setGenerating(orderId);
    setError('');
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/label`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error generando etiqueta');
      await fetchOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGenerating(null);
    }
  };

  const updateOrderStatus = async (orderId: number, newStatus: 'paid' | 'cancelled') => {
    setUpdatingStatus(orderId);
    setError('');
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error actualizando estado');
      await fetchOrders();
      // Actualizar el modal si esta abierto
      if (selected && selected.id === orderId) {
        setSelected({ ...selected, status: newStatus });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'approved' || s === 'completed' || s === 'paid') return 'bg-green-100 text-green-800';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (s === 'cancelled' || s === 'failed') return 'bg-red-100 text-red-800';
    return 'bg-neutral-100 text-neutral-800';
  };

  const getStatusLabel = (s: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      paid: 'Pagado',
      cancelled: 'Cancelado',
      failed: 'Fallido',
      approved: 'Aprobado',
      completed: 'Completado',
    };
    return labels[s] || s;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Admin de Envios</h1>
        <Link href="/admin" className="inline-flex min-h-11 items-center justify-center border rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 sm:self-start">Ir a Admin Productos</Link>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Admin Secret</label>
        <input type="password" className="min-h-11 w-full max-w-lg border rounded-lg px-3 py-2" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Pega el ADMIN_SECRET" />
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      <div className="flex justify-end mb-3">
        <button className="min-h-10 border rounded-lg px-3 py-1 text-sm hover:bg-neutral-100" onClick={fetchOrders} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="space-y-3 lg:hidden">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm">Orden #{o.id}</div>
                <div className="text-sm break-words text-neutral-600">{o.email || '-'}</div>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${statusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-neutral-500">Teléfono:</span> {o.shipping_address?.phone || o.buyer_phone || '-'}</div>
              <div><span className="text-neutral-500">Total:</span> {(() => {
                if (typeof o.total_amount === 'number' && o.total_amount > 0) return formatoPrecio(o.total_amount || 0);
                if (typeof o.original_amount === 'number' && o.original_amount > 0) return formatoPrecio(o.original_amount || 0);
                if (Array.isArray(o.items)) {
                  const sum = o.items.reduce((acc, it) => acc + ((it.unit_price || 0) * (it.quantity || 1)), 0);
                  return formatoPrecio(sum);
                }
                return formatoPrecio(0);
              })()}</div>
              <div><span className="text-neutral-500">Pago:</span> {o.payment_method === 'transfer' ? 'Transferencia' : 'MP'}{o.discount_applied && o.discount_applied > 0 ? ' (-20%)' : ''}</div>
              <div><span className="text-neutral-500">Envío:</span> {o.envio_tipo === 'correo_argentino' ? 'Correo Argentino' : o.envio_tipo === 'concordia_gratis' ? 'Concordia' : o.envio_tipo === 'retiro_local' ? 'Retiro local' : '-'}</div>
              <div><span className="text-neutral-500">Tracking:</span> <span className="break-all">{o.envio_tracking || '-'}</span></div>
              <div><span className="text-neutral-500">Fecha:</span> {formatDate(o.created_at)}</div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <button className="text-neutral-900 hover:underline" onClick={() => setSelected(o)}>Ver</button>
              {o.status === 'pending' && (
                <>
                  <button className="text-green-700 hover:underline" onClick={() => updateOrderStatus(o.id, 'paid')} disabled={updatingStatus === o.id}>
                    {updatingStatus === o.id ? '...' : 'Pagar'}
                  </button>
                  <button className="text-red-700 hover:underline" onClick={() => updateOrderStatus(o.id, 'cancelled')} disabled={updatingStatus === o.id}>
                    {updatingStatus === o.id ? '...' : 'Cancelar'}
                  </button>
                </>
              )}
              {o.envio_tipo === 'correo_argentino' && !o.envio_label_url && (
                <button
                  className="text-purple-700 hover:underline"
                  onClick={() => {
                    if (o.status !== 'paid' && o.status !== 'approved' && o.status !== 'completed') {
                      alert('Solo disponible para órdenes pagadas');
                      return;
                    }
                    genLabel(o.id);
                  }}
                  disabled={generating === o.id}
                >
                  {generating === o.id ? 'Gen...' : 'Etiqueta'}
                </button>
              )}
              {o.envio_tipo === 'correo_argentino' && o.envio_label_url && (
                <a href={o.envio_label_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                  Ver etiqueta
                </a>
              )}
              {o.envio_tipo === 'concordia_gratis' && (o.shipping_address?.phone || o.buyer_phone) && (() => {
                const rawPhone = o.shipping_address?.phone || o.buyer_phone || '';
                const phone = String(rawPhone).replace(/[^0-9]/g, '');
                if (phone.length >= 8 && phone.length <= 15) {
                  return <a href={`https://wa.me/54${phone}`} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">WhatsApp</a>;
                }
                return null;
              })()}
              {o.envio_tipo === 'retiro_local' && o.status === 'paid' && <span className="text-green-700">Listo para retirar</span>}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="py-6 text-center text-neutral-500">Sin ordenes...</p>}
      </div>

      <div className="hidden overflow-x-auto border rounded-xl lg:block">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Teléfono</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Pago</th>
              <th className="px-3 py-2 text-left">Método de Envío</th>
              <th className="px-3 py-2 text-left">Tracking</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-mono">{o.id}</td>
                <td className="px-3 py-2">{o.email || '-'}</td>
                <td className="px-3 py-2">{o.shipping_address?.phone || o.buyer_phone || '-'}</td>
                <td className="px-3 py-2">{
                  (() => {
                    // Mostrar siempre el total_amount, que ahora es el valor correcto
                    if (typeof o.total_amount === 'number' && o.total_amount > 0) return formatoPrecio(o.total_amount || 0);
                    if (typeof o.original_amount === 'number' && o.original_amount > 0) return formatoPrecio(o.original_amount || 0);
                    if (Array.isArray(o.items)) {
                      const sum = o.items.reduce((acc, it) => acc + ((it.unit_price || 0) * (it.quantity || 1)), 0);
                      return formatoPrecio(sum);
                    }
                    return formatoPrecio(0);
                  })()
                }</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(o.status)}`}>{getStatusLabel(o.status)}</span></td>
                <td className="px-3 py-2">
                  <span className="text-xs">{o.payment_method === 'transfer' ? 'Transferencia' : 'MP'}</span>
                  {o.discount_applied && o.discount_applied > 0 && (
                    <span className="text-xs text-green-600 ml-1">(-20%)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {o.envio_tipo === 'correo_argentino' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium">Correo Argentino</span>
                  )}
                  {o.envio_tipo === 'concordia_gratis' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">Concordia</span>
                  )}
                  {o.envio_tipo === 'retiro_local' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">Retiro local</span>
                  )}
                  {(o.envio_tipo === '-' || !o.envio_tipo) && <span className="text-xs">-</span>}
                  {o.envio_estado && <span className="text-xs text-neutral-500 ml-1">({o.envio_estado})</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{o.envio_tracking || '-'}</td>
                <td className="px-3 py-2 text-xs">{formatDate(o.created_at)}</td>
                <td className="px-3 py-2 space-x-1">
                  <button className="text-neutral-900 hover:underline text-xs" onClick={() => setSelected(o)}>Ver</button>
                  {o.status === 'pending' && (
                    <>
                      <button 
                        className="text-green-700 hover:underline text-xs ml-1" 
                        onClick={() => updateOrderStatus(o.id, 'paid')}
                        disabled={updatingStatus === o.id}
                      >
                        {updatingStatus === o.id ? '...' : 'Pagar'}
                      </button>
                      <button 
                        className="text-red-700 hover:underline text-xs ml-1" 
                        onClick={() => updateOrderStatus(o.id, 'cancelled')}
                        disabled={updatingStatus === o.id}
                      >
                        {updatingStatus === o.id ? '...' : 'Cancelar'}
                      </button>
                    </>
                  )}
                  {/* Acciones específicas por método de envío */}
                  {o.envio_tipo === 'correo_argentino' && !o.envio_label_url && (
                    <>
                      <button
                        className="text-purple-700 hover:underline text-xs ml-1"
                        onClick={() => {
                          if (o.status !== 'paid' && o.status !== 'approved' && o.status !== 'completed') {
                            alert('Solo disponible para órdenes pagadas');
                            return;
                          }
                          genLabel(o.id);
                        }}
                        disabled={generating === o.id}
                      >
                        {generating === o.id ? 'Gen...' : 'Etiqueta'}
                      </button>
                    </>
                  )}
                  {o.envio_tipo === 'correo_argentino' && o.envio_label_url && (
                    <a href={o.envio_label_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-xs ml-1">
                      Ver etiqueta
                    </a>
                  )}
                  {o.envio_tipo === 'concordia_gratis' && (o.shipping_address?.phone || o.buyer_phone) && (() => {
                    const rawPhone = o.shipping_address?.phone || o.buyer_phone || '';
                    const phone = String(rawPhone).replace(/[^0-9]/g, '');
                    // Acepta números de 8 a 15 dígitos (sin el 54)
                    if (phone.length >= 8 && phone.length <= 15) {
                      return (
                        <a
                          href={`https://wa.me/54${phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:underline text-xs ml-1"
                          title="Contactar por WhatsApp"
                        >
                          WhatsApp
                        </a>
                      );
                    }
                    return null;
                  })()}
                  {o.envio_tipo === 'retiro_local' && o.status === 'paid' && (
                    <span className="text-green-700 text-xs ml-1">Listo para retirar</span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={9} className="text-center py-6 text-neutral-500">Sin ordenes...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-bold text-lg">Orden #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600 text-xl">x</button>
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-neutral-500">Email</dt><dd className="break-all sm:text-right">{selected.email || '-'}</dd></div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Subtotal</dt>
                <dd>{formatoPrecio(Number(selected.original_amount) || 0)}</dd>
              </div>
              {Number(selected.discount_applied) > 0 && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Total original</dt>
                    <dd className="line-through text-neutral-400">{formatoPrecio(Number(selected.original_amount) || 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Descuento</dt>
                    <dd className="text-green-600 font-medium">-{formatoPrecio(Number(selected.discount_applied) || 0)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between"><dt className="text-neutral-500 font-bold">TOTAL FINAL</dt><dd className="font-bold text-green-700 text-lg">{formatoPrecio(selected.total_amount || 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Metodo de pago</dt><dd>{selected.payment_method === 'transfer' ? 'Transferencia' : 'Mercado Pago'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Estado</dt><dd><span className={`px-2 py-0.5 rounded text-xs ${statusColor(selected.status)}`}>{getStatusLabel(selected.status)}</span></dd></div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-neutral-500">Payment ID</dt><dd className="font-mono break-all sm:text-right">{selected.payment_id || '-'}</dd></div>
              {selected.envio_tipo && (
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <dt className="text-neutral-500">Método de Envío</dt>
                  <dd className="sm:text-right">
                    {selected.envio_tipo === 'correo_argentino' && 'Correo Argentino'}
                    {selected.envio_tipo === 'concordia_gratis' && 'Concordia'}
                    {selected.envio_tipo === 'retiro_local' && 'Retiro local'}
                    {selected.envio_estado && ` (${selected.envio_estado})`}
                  </dd>
                </div>
              )}
              {selected.envio_tracking && <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-neutral-500">Tracking</dt><dd className="font-mono break-all sm:text-right">{selected.envio_tracking}</dd></div>}
              {selected.envio_costo != null && <div className="flex justify-between"><dt className="text-neutral-500">Costo envío</dt><dd>{formatoPrecio(selected.envio_costo)}</dd></div>}
              {selected.envio_estimacion && <div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-neutral-500">Estimación</dt><dd className="sm:text-right">{selected.envio_estimacion}</dd></div>}
            </dl>

            {/* Botones de accion para actualizar estado */}
            {selected.status === 'pending' && (
              <div className="mt-4 p-4 bg-neutral-50 rounded-lg">
                <p className="text-sm font-medium mb-3">Actualizar estado:</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => updateOrderStatus(selected.id, 'paid')}
                    disabled={updatingStatus === selected.id}
                    className="min-h-11 flex-1 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {updatingStatus === selected.id ? 'Procesando...' : 'Marcar como Pagado'}
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selected.id, 'cancelled')}
                    disabled={updatingStatus === selected.id}
                    className="min-h-11 flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {updatingStatus === selected.id ? 'Procesando...' : 'Marcar como Cancelado'}
                  </button>
                </div>
              </div>
            )}

            {selected.items && selected.items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2">Items</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {selected.items.map((it, i) => (
                    <li key={i}>{it.name} {it.variant_label ? `(${it.variant_label})` : ''} x{it.quantity} - {formatoPrecio(it.unit_price)}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Dirección solo si corresponde */}
              {selected.shipping_address && selected.envio_tipo !== 'retiro_local' && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-1">Dirección de envío</h4>
                  <div className="bg-neutral-50 rounded p-2 text-xs overflow-auto">
                    {composeAddress(selected.shipping_address)}
                    {(selected.shipping_address.phone || selected.buyer_phone) && (
                      <div className="mt-1">
                        <span className="font-semibold">Tel:</span> {selected.shipping_address.phone || selected.buyer_phone}
                      </div>
                    )}
                  </div>
                </div>
              )}
            {selected.envio_tipo === 'retiro_local' && selected.shipping_address && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-1">Contacto para retiro</h4>
                <div className="bg-neutral-50 rounded p-2 text-xs overflow-auto">
                  {selected.shipping_address.phone && (
                    <div>
                      <span className="font-semibold">Tel:</span> {selected.shipping_address.phone}
                    </div>
                  )}
                  {selected.shipping_address.email && (
                    <div>
                      <span className="font-semibold">Email:</span> {selected.shipping_address.email}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
