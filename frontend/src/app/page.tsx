'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProductCard from '@/components/ProductCard';
import type { ProductMapped } from '@/types';

const placeholderImg = 'https://picsum.photos/600/600?grayscale&blur=1';

function mapProduct(p: Record<string, unknown>): ProductMapped {
  const images = p.images as Array<{ url?: string } | string> | undefined;
  const firstImg =
    Array.isArray(images) && images.length > 0
      ? typeof images[0] === 'string'
        ? images[0]
        : (images[0] as { url?: string }).url || null
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

export default function HomePage() {
  const [productos, setProductos] = useState<ProductMapped[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    async function fetchProductos() {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Error al cargar productos');
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

  return (
    <div>
      {/* Hero banner */}
      <div className="relative min-h-[50vh] flex flex-col items-center justify-center text-white bg-gray-900">
        <Image
          src="https://picsum.photos/1200/600?random=1"
          alt="Banner"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Bienvenido a Luxe 👕</h1>
          <p className="text-lg md:text-xl mb-6">Moda urbana y estilo para todos los días</p>
          <Link
            href="/productos"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
          >
            Ver Productos
          </Link>
        </div>
      </div>

      {/* Featured products */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-semibold mb-6">Productos destacados</h2>
        {loading ? (
          <p className="text-gray-500">Cargando productos...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productos.map((producto) => (
              <ProductCard key={producto.id} producto={producto} />
            ))}
          </div>
        )}
      </div>

      {/* Novelties */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold text-center mb-8">Novedades</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { img: 'https://picsum.photos/400/300?random=2', title: 'Nueva Colección', text: 'Explorá las últimas tendencias en moda urbana.' },
            { img: 'https://picsum.photos/400/300?random=3', title: 'Ofertas Especiales', text: 'Encontrá descuentos en productos seleccionados.' },
            { img: 'https://picsum.photos/400/300?random=4', title: 'Envíos a todo el país', text: 'Recibí tu pedido en cualquier provincia de Argentina.' },
          ].map((card) => (
            <div key={card.title} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="relative h-48">
                <Image src={card.img} alt={card.title} fill className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2">{card.title}</h3>
                <p className="text-gray-600 text-sm">{card.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
