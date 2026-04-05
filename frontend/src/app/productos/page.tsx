'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import type { ProductMapped } from '@/types';

const placeholderImg = 'https://picsum.photos/600/600?grayscale&blur=1';

function mapProduct(p: Record<string, unknown>): ProductMapped {
  const images = p.images as Array<{ url?: string } | string> | undefined;
  const firstImg =
    Array.isArray(images) && images.length > 0
      ? typeof images[0] === 'string' ? images[0] : (images[0] as { url?: string }).url || null
      : null;
  const attrs = p.attributes as Record<string, string> | undefined;
  return {
    id: p.id as number,
    slug: (p.slug as string) || '',
    name: (p.name as string) || '',
    desc: (p.description as string) || '',
    img: firstImg || placeholderImg,
    price: Number((p.price_min as number) ?? (p.price as number) ?? 0),
    tipo: attrs?.tipo || attrs?.category || '',
    talles: [],
    colores: [],
  };
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductMapped[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [talle, setTalle] = useState('');
  const [color, setColor] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let abort = false;
    async function fetchProductos() {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        const mapped = ((data.products as Record<string, unknown>[]) || []).map(mapProduct);
        if (!abort) setProductos(mapped);
      } catch {
        if (!abort) setProductos([]);
      } finally {
        if (!abort) setLoading(false);
      }
    }
    fetchProductos();
    return () => { abort = true; };
  }, []);

  const tipos = Array.from(new Set(productos.map((p) => p.tipo).filter(Boolean)));
  const tallesTipo = tipo
    ? Array.from(new Set(productos.filter((p) => p.tipo === tipo).flatMap((p) => p.talles)))
    : [];
  const colores = Array.from(new Set(productos.flatMap((p) => p.colores)));

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda = p.name.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTalle = tipo && talle ? p.talles.includes(talle) : true;
    const coincideColor = color ? p.colores.includes(color) : true;
    const coincideTipo = tipo ? p.tipo === tipo : true;
    const coincidePrecioMin = precioMin ? p.price >= Number(precioMin) : true;
    const coincidePrecioMax = precioMax ? p.price <= Number(precioMax) : true;
    return coincideBusqueda && coincideTalle && coincideColor && coincideTipo && coincidePrecioMin && coincidePrecioMax;
  });

  const filtrosJSX = (
    <div className="space-y-4">
      <input
        type="text"
        className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
        placeholder="Buscar..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <select
        className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
        value={tipo}
        onChange={(e) => { setTipo(e.target.value); setTalle(''); }}
      >
        <option value="">Tipo</option>
        {tipos.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
      </select>
      {tipo && tallesTipo.length > 0 && (
        <select
          className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
          value={talle}
          onChange={(e) => setTalle(e.target.value)}
        >
          <option value="">Talle</option>
          {tallesTipo.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {colores.length > 0 && (
        <select
          className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors bg-white"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        >
          <option value="">Color</option>
          {colores.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          className="border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          placeholder="Min $"
          value={precioMin}
          onChange={(e) => setPrecioMin(e.target.value)}
          min={0}
        />
        <input
          type="number"
          className="border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          placeholder="Max $"
          value={precioMax}
          onChange={(e) => setPrecioMax(e.target.value)}
          min={0}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-neutral-100 rounded-2xl" />
              <div className="mt-4 h-4 bg-neutral-100 rounded w-3/4" />
              <div className="mt-2 h-3 bg-neutral-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-light tracking-tight text-neutral-900">Shop</h1>
        <p className="mt-2 text-neutral-500 text-sm">{productosFiltrados.length} productos</p>
      </div>

      {/* Mobile filter button */}
      <div className="md:hidden flex justify-end mb-6">
        <button
          className="flex items-center gap-2 border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:border-neutral-900 transition-colors"
          onClick={() => setShowFilters(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filtrar
        </button>
      </div>

      {/* Mobile filters offcanvas */}
      {showFilters && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setShowFilters(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-[70] shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-neutral-100">
              <h3 className="text-sm font-semibold uppercase tracking-widest">Filtros</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">{filtrosJSX}</div>
          </div>
        </>
      )}

      <div className="flex gap-12">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-56 flex-shrink-0">
          <div className="sticky top-[80px]">
            <p className="text-xs uppercase tracking-widest text-neutral-400 mb-4">Filtros</p>
            {filtrosJSX}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1">
          {productosFiltrados.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-400 text-sm">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {productosFiltrados.map((producto) => (
                <ProductCard key={producto.id} producto={producto} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
