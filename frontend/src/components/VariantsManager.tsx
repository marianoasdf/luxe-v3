'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { authFetch } from '@/lib/api';
import type { VariantRow } from '@/types';

interface VariantsManagerProps {
  productId: number;
  secret: string;
  headers: Record<string, string>;
  productPrice: number;
}

interface VariantForm {
  color: string;
  talle: string;
  precio: number;
  stock: number;
  imagen: string;
}

export default function VariantsManager({ productId, secret, headers, productPrice }: VariantsManagerProps) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VariantForm>({
    color: '',
    talle: '',
    precio: Number(productPrice) || 0,
    stock: 0,
    imagen: '',
  });

  const fetchVariants = async () => {
    if (!productId || !secret) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/admin/products/${productId}/variants`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error cargando variantes');
      setVariants(data.variants || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando variantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && variants.length === 0) {
      fetchVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, productId]);

  const emptyForm = (): VariantForm => ({
    color: '',
    talle: '',
    precio: Number(productPrice) || 0,
    stock: 0,
    imagen: '',
  });

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (v: VariantRow) => {
    setEditingId(v.id);
    const ov = v.option_values || {};
    setForm({
      color: ov.color || '',
      talle: ov.talle || '',
      precio: Number(v.price || productPrice || 0),
      stock: Number(v.stock || 0),
      imagen: v.image_url || '',
    });
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'precio' || name === 'stock' ? Number(value) : value,
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        option_values: { color: form.color, talle: form.talle },
        price: form.precio,
        stock: form.stock,
        image_url: form.imagen.trim() || null,
      };
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `/api/admin/variants/${editingId}`
        : `/api/admin/products/${productId}/variants`;
      const res = await authFetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error guardando variante');
      await fetchVariants();
      startCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const remove = async (v: VariantRow) => {
    const ov = v.option_values || {};
    if (!confirm(`¿Eliminar variante ${ov.color || ''} ${ov.talle || ''}?`)) return;
    setError('');
    try {
      const res = await authFetch(`/api/admin/variants/${v.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Error eliminando');
      await fetchVariants();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="border rounded-lg mt-4">
      <div className="flex justify-between items-center px-4 py-3 bg-neutral-50 rounded-t-lg">
        <h4 className="text-sm font-semibold">Variantes (Color, Talle, Precio, Stock)</h4>
        <button
          className="text-sm px-3 py-1 border rounded hover:bg-neutral-100"
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded && variants.length === 0) fetchVariants();
          }}
        >
          {expanded ? 'Colapsar' : 'Expandir'}
        </button>
      </div>

      {expanded && (
        <div className="p-4">
          {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm mb-3">{error}</div>}

          <form onSubmit={onSubmit} className="mb-6 p-4 border rounded bg-neutral-50">
            <h5 className="font-medium mb-3">{editingId ? 'Editar variante' : 'Nueva variante'}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Color</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  name="color"
                  value={form.color}
                  onChange={onChange}
                  placeholder="Ej: Rojo"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Talle</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  name="talle"
                  value={form.talle}
                  onChange={onChange}
                  placeholder="Ej: M, L, XL"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Precio</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  name="precio"
                  value={form.precio}
                  onChange={onChange}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Stock</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  name="stock"
                  value={form.stock}
                  onChange={onChange}
                  min="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Imagen de la variante (URL)</label>
                <input
                  type="url"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  name="imagen"
                  value={form.imagen}
                  onChange={onChange}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" className="bg-neutral-900 text-white px-4 py-1.5 rounded text-sm hover:bg-neutral-800">
                {editingId ? 'Guardar' : 'Crear'}
              </button>
              {editingId && (
                <button type="button" className="border px-4 py-1.5 rounded text-sm hover:bg-neutral-100" onClick={startCreate}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <h5 className="font-medium mb-2 text-sm">Lista ({variants.length})</h5>
          {loading ? (
            <div className="text-neutral-500 text-sm">Cargando…</div>
          ) : variants.length === 0 ? (
            <div className="text-neutral-400 text-sm">Sin variantes creadas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left px-3 py-2">Color</th>
                    <th className="text-left px-3 py-2">Talle</th>
                    <th className="text-left px-3 py-2">Precio</th>
                    <th className="text-left px-3 py-2">Stock</th>
                    <th className="text-left px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const ov = v.option_values || {};
                    return (
                      <tr key={v.id} className="border-t hover:bg-neutral-50">
                        <td className="px-3 py-2">{ov.color || '-'}</td>
                        <td className="px-3 py-2">{ov.talle || '-'}</td>
                        <td className="px-3 py-2">$ {Number(v.price || productPrice || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{v.stock}</td>
                        <td className="px-3 py-2 flex gap-1">
                          <button className="text-neutral-900 hover:underline text-sm" onClick={() => startEdit(v)}>
                            Editar
                          </button>
                          <button className="text-red-600 hover:underline text-sm" onClick={() => remove(v)}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
