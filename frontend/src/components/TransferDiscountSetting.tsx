'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import { authFetch } from '@/lib/api';
import {
  MAX_TRANSFER_DISCOUNT_PERCENT,
  setTransferDiscountCache,
  useTransferDiscount,
} from '@/lib/transferDiscount';

interface TransferDiscountSettingProps {
  secret: string;
}

export default function TransferDiscountSetting({ secret }: TransferDiscountSettingProps) {
  const current = useTransferDiscount();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (current !== null) setValue(String(current));
  }, [current]);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!secret) { setError('Ingresá el Admin Secret'); return; }

    const percent = Number(value);
    if (value.trim() === '' || !Number.isInteger(percent) || percent < 0 || percent > MAX_TRANSFER_DISCOUNT_PERCENT) {
      setError(`Ingresá un número entero entre 0 y ${MAX_TRANSFER_DISCOUNT_PERCENT}`);
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch('/api/admin/settings/transfer-discount', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ percent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error guardando el descuento');
      setTransferDiscountCache(data.percent);
      setMessage(data.percent > 0 ? `Guardado: ${data.percent}% OFF con transferencia` : 'Guardado: sin descuento por transferencia');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 border rounded-xl overflow-hidden max-w-lg">
      <div className="bg-neutral-50 px-4 py-3 font-semibold">Descuento por transferencia</div>
      <form onSubmit={submit} className="p-4 space-y-3">
        <p className="text-sm text-neutral-500">
          Se aplica a los pedidos nuevos y se muestra en el banner, la ficha de producto y el checkout. Con 0 se desactiva.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={MAX_TRANSFER_DISCOUNT_PERCENT}
              step={1}
              className="min-h-11 w-24 border rounded-lg px-3 py-2"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="text-sm">%</span>
          </div>
          <button
            type="submit"
            className="min-h-11 bg-neutral-900 text-white px-6 py-2 rounded-lg hover:bg-neutral-800 disabled:opacity-50"
            disabled={saving || !secret}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {message && <div className="text-sm text-green-700">{message}</div>}
        {error && <div className="text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}
