'use client';

import React, { useEffect, useMemo, useState, useRef, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cdnImage } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import VariantsManager from '@/components/VariantsManager';

function useAdminSecret(): [string, (s: string) => void] {
  const [secret, setSecret] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('ADMIN_SECRET') || '' : '',
  );
  useEffect(() => { sessionStorage.setItem('ADMIN_SECRET', secret || ''); }, [secret]);
  return [secret, setSecret];
}

interface ProductForm {
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  brand: string;
  imagesText: string;
  status: string;
}

interface ImageObj {
  url: string;
  public_id?: string | null;
}

interface ProductListItem {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  sku?: string;
  description?: string;
  brand?: string;
  images?: Array<ImageObj | string>;
  status?: string;
  attributes?: Record<string, unknown>;
}

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

function emptyProduct(): ProductForm {
  return { sku: '', name: '', slug: '', description: '', price: 0, currency: 'ARS', brand: '', imagesText: '', status: 'active' };
}

const normalizeSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function AdminProductsPage() {
  const [secret, setSecret] = useAdminSecret();
  const [list, setList] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedItems, setUploadedItems] = useState<Array<{ name: string; url: string | null; error?: string }>>([]);
  const [images, setImages] = useState<ImageObj[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const draggingIndexRef = useRef<number | null>(null);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', ...(secret ? { 'x-admin-secret': secret } : {}) }),
    [secret],
  );

  const fetchList = async () => {
    if (!secret) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/products', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error cargando productos');
      setList(data.products || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [secret]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyProduct());
    setUploadedItems([]);
    setImages([]);
    setSlugTouched(false);
  };

  const startEdit = (p: ProductListItem) => {
    setEditingId(p.id);
    setSlugTouched(true);
    const arr = Array.isArray(p.images) ? p.images.map((x) => (typeof x === 'string' ? { url: x } : x)) : [];
    const normalized = arr.slice(0, MAX_IMAGES);
    setImages(normalized);
    setForm({
      sku: p.sku || '',
      name: p.name || '',
      slug: p.slug || '',
      description: p.description || '',
      price: Number(p.price || 0),
      currency: p.currency || 'ARS',
      brand: p.brand || '',
      imagesText: normalized.map((x) => x.url).join(','),
      status: p.status || 'active',
    });
  };

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'price' ? Number(value) : value }));
    if (name === 'imagesText') {
      const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
      const next = arr.slice(0, MAX_IMAGES).map((u) => ({ url: u }));
      setImages(next);
    }
    if (name === 'name' && !slugTouched) {
      const auto = normalizeSlug(value);
      setForm((prev) => ({ ...prev, slug: auto }));
    }
  };

  const onSelectFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const warnings: string[] = [];
    const accepted: File[] = [];
    const currentCount = images.length + pendingFiles.length;
    for (const f of files) {
      if (accepted.length + currentCount >= MAX_IMAGES) { warnings.push(`Máximo ${MAX_IMAGES} imágenes.`); break; }
      if (f.size > MAX_BYTES) { warnings.push(`${f.name} supera 5MB.`); continue; }
      if (!ALLOWED_MIME.includes(f.type)) { warnings.push(`${f.name} tipo no permitido.`); continue; }
      accepted.push(f);
    }
    setUploadWarnings(warnings);
    setPendingFiles((prev) => [...prev, ...accepted]);
  };

  const uploadFile = async (file: File): Promise<{ name: string; url: string; public_id: string }> => {
    const folderSlug = form.slug.trim().toLowerCase() || 'temp';
    const leafBase = `${folderSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sigRes = await authFetch('/api/admin/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ folder: `products/${folderSlug}`, public_id: leafBase }),
    });
    const sigData = await sigRes.json();
    if (!sigRes.ok) throw new Error(sigData.error || 'Error firma');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigData.apiKey);
    formData.append('timestamp', sigData.timestamp);
    formData.append('signature', sigData.signature);
    if (sigData.folder) formData.append('folder', sigData.folder);
    if (sigData.uploadPreset) formData.append('upload_preset', sigData.uploadPreset);
    if (sigData.publicId) formData.append('public_id', sigData.publicId);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Error subiendo');
    return { name: file.name, url: json.secure_url, public_id: json.public_id };
  };

  const uploadSelected = async () => {
    if (!secret || !pendingFiles.length) return;
    setUploading(true);
    setError('');
    const results: Array<{ name: string; url: string | null; error?: string }> = [];
    for (const file of pendingFiles) {
      try {
        const r = await uploadFile(file);
        results.push(r);
      } catch (err) {
        results.push({ name: file.name, url: null, error: err instanceof Error ? err.message : 'Error' });
      }
    }
    setUploadedItems((prev) => [...prev, ...results]);
    const successObjs = results.filter((r): r is { name: string; url: string; public_id?: string } => !!r.url);
    if (successObjs.length) {
      setImages((prev) => {
        const merged = [...prev, ...successObjs.map((r) => ({ url: r.url, public_id: r.public_id }))].slice(0, MAX_IMAGES);
        setForm((f) => ({ ...f, imagesText: merged.map((x) => x.url).join(',') }));
        return merged;
      });
    }
    setPendingFiles([]);
    setUploading(false);
  };

  const onDragStart = (idx: number) => () => { draggingIndexRef.current = idx; };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = draggingIndexRef.current;
    if (from === null || from === idx) return;
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(idx, 0, item);
      setForm((f) => ({ ...f, imagesText: copy.map((x) => x.url).join(',') }));
      return copy;
    });
    draggingIndexRef.current = null;
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const copy = [...prev];
      copy.splice(idx, 1);
      setForm((f) => ({ ...f, imagesText: copy.map((x) => x.url).join(',') }));
      return copy;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!secret) { setError('Ingresá el Admin Secret'); return; }
    const payload = {
      sku: form.sku || null,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description || null,
      price: Number(form.price || 0),
      currency: 'ARS',
      brand: form.brand || null,
      images: images.slice(0, MAX_IMAGES),
      attributes: { primary_image: images[0] || null },
      status: form.status || 'active',
    };
    try {
      const res = await authFetch(editingId ? `/api/admin/products/${editingId}` : '/api/admin/products', {
        method: editingId ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error guardando');
      await fetchList();
      startCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const remove = async (p: ProductListItem) => {
    if (!secret) { setError('Ingresá el Admin Secret'); return; }
    if (!confirm(`Eliminar "${p.name}"?`)) return;
    try {
      const res = await authFetch(`/api/admin/products/${p.id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error eliminando');
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Admin de Productos</h1>
        <Link href="/admin/envios" className="inline-flex min-h-11 items-center justify-center border rounded-lg px-4 py-2 text-sm hover:bg-neutral-100 sm:self-start">Ir a Admin Envíos</Link>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Admin Secret</label>
        <input type="password" className="min-h-11 w-full max-w-lg border rounded-lg px-3 py-2" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Pegá el ADMIN_SECRET" />
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      <div className="grid gap-8 xl:grid-cols-2">
        {/* Form */}
        <div className="min-w-0 border rounded-xl overflow-hidden">
          <div className="bg-neutral-50 px-4 py-3 font-semibold">{editingId ? 'Editar producto' : 'Crear producto'}</div>
          <div className="p-4">
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Nombre</label>
                <input className="w-full border rounded-lg px-3 py-2" name="name" value={form.name} onChange={onChange} required />
              </div>
              <div>
                <label className="block text-sm mb-1">Precio</label>
                <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" name="price" value={form.price} onChange={onChange} />
              </div>
              <div>
                <label className="block text-sm mb-1">Marca</label>
                <input className="w-full border rounded-lg px-3 py-2" name="brand" value={form.brand} onChange={onChange} />
              </div>
              <div>
                <label className="block text-sm mb-1">Subir archivos</label>
                <input type="file" multiple className="min-h-11 w-full border rounded-lg px-3 py-2" onChange={onSelectFiles} disabled={uploading} />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button type="button" className="min-h-10 border rounded-lg px-3 py-1 text-sm hover:bg-neutral-100" onClick={uploadSelected} disabled={uploading || !pendingFiles.length}>
                    {uploading ? 'Subiendo…' : 'Subir'}
                  </button>
                  {pendingFiles.length > 0 && !uploading && <span className="text-sm text-neutral-500">{pendingFiles.length} listo(s)</span>}
                </div>
                {uploadWarnings.length > 0 && (
                  <div className="text-yellow-600 text-sm mt-1">{uploadWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
                )}
              </div>
              {images.length > 0 && (
                <div>
                  <label className="block text-sm mb-1">Miniaturas (primera = principal)</label>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-2">
                    {images.map((img, idx) => (
                      <div
                        key={`${img.url}-${idx}`}
                        className="relative aspect-square border rounded overflow-hidden cursor-grab flex flex-col"
                        draggable
                        onDragStart={onDragStart(idx)}
                        onDragOver={onDragOver}
                        onDrop={onDrop(idx)}
                      >
                        <Image src={cdnImage(img.url)} alt="img" fill className="object-cover" />
                        <div className="absolute top-0 left-0 right-0 flex justify-between bg-black/40 text-white text-[10px] px-1">
                          <span>{idx === 0 ? 'PPAL' : 'IMG'}</span>
                          <button type="button" onClick={() => removeImage(idx)} className="hover:text-red-300">✕</button>
                        </div>
                        {/* URL original y botón copiar mejorados */}
                        <div className="relative w-full bg-white/90 text-[10px] text-neutral-700 px-1 py-0.5 border-t border-neutral-200 flex items-center gap-1 min-h-[18px]" style={{position:'absolute',bottom:0,left:0,right:0}}>
                          <span
                            style={{ userSelect: 'all', overflowWrap: 'anywhere', maxWidth: '80px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'inline-block' }}
                            title={img.url}
                          >
                            {img.url}
                          </span>
                          <button
                            type="button"
                            className="ml-auto text-blue-600 hover:underline text-[10px] px-1"
                            title="Copiar URL"
                            style={{ lineHeight: 1, padding: 0 }}
                            onClick={() => { navigator.clipboard.writeText(img.url); }}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm mb-1">Descripción</label>
                <textarea className="w-full border rounded-lg px-3 py-2" name="description" rows={3} value={form.description} onChange={onChange} />
              </div>
              <div>
                <label className="block text-sm mb-1">Estado</label>
                <select className="w-full border rounded-lg px-3 py-2" name="status" value={form.status} onChange={onChange}>
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="min-h-11 bg-neutral-900 text-white px-6 py-2 rounded-lg hover:bg-neutral-800">{editingId ? 'Guardar' : 'Crear'}</button>
                {editingId && <button type="button" className="min-h-11 border px-6 py-2 rounded-lg hover:bg-neutral-100" onClick={startCreate}>Cancelar</button>}
              </div>
            </form>
            {editingId && <VariantsManager productId={editingId} secret={secret} headers={headers} productPrice={form.price} />}
          </div>
        </div>

        {/* List */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Productos</h2>
            <button className="min-h-10 border rounded-lg px-3 py-1 text-sm hover:bg-neutral-100 sm:self-start" onClick={fetchList} disabled={loading}>
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 border rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium break-words">{p.name}</div>
                  <div className="text-sm text-neutral-500 break-words">{p.slug} · {p.currency} {p.price}</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="text-neutral-900 text-sm hover:underline" onClick={() => startEdit(p)}>Editar</button>
                  <button className="text-red-600 text-sm hover:underline" onClick={() => remove(p)}>Eliminar</button>
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="text-neutral-500">Sin productos…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
