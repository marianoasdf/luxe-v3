'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/api';
import { formatoPrecio, formatDate } from '@/lib/utils';

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
  email?: string;
  total: number;
  currency: string;
  status: string;
  envio_tipo?: string;
  envio_estado?: string;
  envio_tracking?: string;
  envio_label_url?: string;
  envio_costo?: number;
  envio_estimacion?: string;
  created_at: string;
  payment_id?: string;
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
      if (!res.ok) throw new Error(data?.error || 'Error cargando órdenes');
      setOrders(data.orders || []);
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

  const statusColor = (s: string) => {
    if (s === 'approved' || s === 'completed') return 'bg-green-100 text-green-800';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
    return 'bg-neutral-100 text-neutral-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin de Envíos</h1>
        <Link href="/admin" className="border rounded-lg px-4 py-2 text-sm hover:bg-neutral-100">Ir a Admin Productos</Link>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Admin Secret</label>
        <input type="password" className="w-full md:w-96 border rounded-lg px-3 py-2" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Pegá el ADMIN_SECRET" />
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      <div className="flex justify-end mb-3">
        <button className="border rounded-lg px-3 py-1 text-sm hover:bg-neutral-100" onClick={fetchOrders} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Envío</th>
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
                <td className="px-3 py-2">{formatoPrecio(o.total)}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(o.status)}`}>{o.status}</span></td>
                <td className="px-3 py-2">
                  <span className="text-xs">{o.envio_tipo || '-'}</span>
                  {o.envio_estado && <span className="text-xs text-neutral-500 ml-1">({o.envio_estado})</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{o.envio_tracking || '-'}</td>
                <td className="px-3 py-2 text-xs">{formatDate(o.created_at)}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="text-neutral-900 hover:underline text-xs" onClick={() => setSelected(o)}>Ver</button>
                  {o.envio_tipo && !o.envio_label_url && (
                    <button className="text-green-700 hover:underline text-xs" onClick={() => genLabel(o.id)} disabled={generating === o.id}>
                      {generating === o.id ? 'Generando…' : 'Gen. etiqueta'}
                    </button>
                  )}
                  {o.envio_label_url && (
                    <a href={o.envio_label_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-xs">
                      Etiqueta
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-neutral-500">Sin órdenes…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Orden #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600 text-xl">✕</button>
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Email</dt><dd>{selected.email || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Total</dt><dd>{formatoPrecio(selected.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Estado</dt><dd>{selected.status}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Payment ID</dt><dd className="font-mono">{selected.payment_id || '-'}</dd></div>
              {selected.envio_tipo && <div className="flex justify-between"><dt className="text-neutral-500">Envío</dt><dd>{selected.envio_tipo} ({selected.envio_estado || '-'})</dd></div>}
              {selected.envio_tracking && <div className="flex justify-between"><dt className="text-neutral-500">Tracking</dt><dd className="font-mono">{selected.envio_tracking}</dd></div>}
              {selected.envio_costo != null && <div className="flex justify-between"><dt className="text-neutral-500">Costo envío</dt><dd>{formatoPrecio(selected.envio_costo)}</dd></div>}
              {selected.envio_estimacion && <div className="flex justify-between"><dt className="text-neutral-500">Estimación</dt><dd>{selected.envio_estimacion}</dd></div>}
            </dl>
            {selected.items && selected.items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2">Ítems</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {selected.items.map((it, i) => (
                    <li key={i}>{it.name} {it.variant_label ? `(${it.variant_label})` : ''} x{it.quantity} – {formatoPrecio(it.unit_price)}</li>
                  ))}
                </ul>
              </div>
            )}
            {selected.shipping_address && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-1">Dirección de envío</h4>
                <pre className="bg-neutral-50 rounded p-2 text-xs overflow-auto">{JSON.stringify(selected.shipping_address, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
