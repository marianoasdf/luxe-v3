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
    <div className="space-y-3">
      <input
        type="text"
        className="w-full border rounded-lg px-3 py-2"
        placeholder="Buscar por nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <select
        className="w-full border rounded-lg px-3 py-2"
        value={tipo}
        onChange={(e) => { setTipo(e.target.value); setTalle(''); }}
      >
        <option value="">Tipo</option>
        {tipos.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
      </select>
      {tipo && tallesTipo.length > 0 && (
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={talle}
          onChange={(e) => setTalle(e.target.value)}
        >
          <option value="">Talle</option>
          {tallesTipo.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {colores.length > 0 && (
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        >
          <option value="">Color</option>
          {colores.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          className="border rounded-lg px-3 py-2"
          placeholder="Min $"
          value={precioMin}
          onChange={(e) => setPrecioMin(e.target.value)}
          min={0}
        />
        <input
          type="number"
          className="border rounded-lg px-3 py-2"
          placeholder="Max $"
          value={precioMax}
          onChange={(e) => setPrecioMax(e.target.value)}
          min={0}
        />
      </div>
    </div>
  );

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-8"><p className="text-gray-500">Cargando productos...</p></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Productos</h1>

      {/* Mobile filter button */}
      <div className="md:hidden flex justify-end mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
          onClick={() => setShowFilters(true)}
        >
          Filtrar
        </button>
      </div>

      {/* Mobile filters offcanvas */}
      {showFilters && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowFilters(false)} />
          <div className="fixed top-0 right-0 h-full w-72 bg-white z-[70] shadow-xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Filtros</h3>
              <button onClick={() => setShowFilters(false)} className="text-xl">&times;</button>
            </div>
            {filtrosJSX}
          </div>
        </>
      )}

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-[80px]">{filtrosJSX}</div>
        </div>

        {/* Products grid */}
        <div className="flex-1">
          {productosFiltrados.length === 0 ? (
            <p className="text-center text-gray-500">No se encontraron productos.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
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
