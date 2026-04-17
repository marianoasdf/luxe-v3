'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProductCard from '@/components/ProductCard';
import FadeIn from '@/components/FadeIn';
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

  // Separar categorías
  const remeras = productos.filter(
    (p) => p.name.toLowerCase().includes('remera') || p.tipo.toLowerCase().includes('remera')
  );
  const buzos = productos.filter(
    (p) => p.name.toLowerCase().includes('buzo') || p.tipo.toLowerCase().includes('buzo')
  );

  return (
    <div className="bg-white">
      {/* ───── HERO ───── */}
      <section className="relative h-[55vh] md:h-[65vh] flex items-center justify-center bg-brand-cream overflow-hidden">
        <Image
          src="https://res.cloudinary.com/duwxe0z39/image/upload/v1776440123/WhatsApp_Image_2026-04-07_at_20.35.41_bcdkmb.jpg"
          alt="Lüxe Argentina"
          fill
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f5f0eb]/60 to-[#f5f0eb]/80" />

        <div className="relative z-10 text-center px-6 max-w-2xl">
          <FadeIn>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-neutral-800 leading-tight">
              Tu estilo, seleccionado
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-4 text-neutral-500 text-sm md:text-base max-w-md mx-auto">
              Local multimarca en Concordia, Entre Ríos. Envíos a todo el país.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Link
              href="/productos"
              className="inline-block mt-8 px-8 py-3 bg-neutral-900 text-white text-sm uppercase tracking-[0.15em] font-medium hover:bg-neutral-700 transition-colors duration-300"
            >
              Ver productos
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ───── PRODUCTOS ───── */}
      <section className="py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <FadeIn>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl md:text-3xl text-neutral-800">
                  Lo nuevo
                </h2>
                <p className="mt-1 text-neutral-400 text-sm">Nuestros productos disponibles</p>
              </div>
              <Link
                href="/productos"
                className="text-xs uppercase tracking-widest text-neutral-500 hover:text-neutral-800 transition-colors hidden md:block"
              >
                Ver todo →
              </Link>
            </div>
          </FadeIn>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-neutral-100 rounded-2xl" />
                  <div className="mt-4 h-4 bg-neutral-100 rounded w-3/4" />
                  <div className="mt-2 h-3 bg-neutral-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {productos.map((producto) => (
                <FadeIn key={producto.id}>
                  <ProductCard producto={producto} />
                </FadeIn>
              ))}
            </div>
          )}

          <FadeIn>
            <div className="mt-10 text-center md:hidden">
              <Link
                href="/productos"
                className="inline-block px-8 py-3 border border-neutral-800 text-neutral-800 text-sm uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 hover:text-white transition-all duration-300"
              >
                Ver todos los productos
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ───── CATEGORÍAS ───── */}
      {(remeras.length > 0 || buzos.length > 0) && (
        <section className="pb-14 md:pb-20">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <FadeIn>
              <h2 className="font-display text-2xl md:text-3xl text-neutral-800 mb-6">
                Categorías
              </h2>
            </FadeIn>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {remeras.length > 0 && (
                <FadeIn>
                  <Link href="/productos" className="group block relative aspect-[16/9] overflow-hidden rounded-2xl">
                    <Image
                      src={remeras[0].img !== placeholderImg ? remeras[0].img : 'https://picsum.photos/800/450?random=10'}
                      alt="Remeras"
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <h3 className="font-display text-2xl md:text-3xl text-white">Remeras</h3>
                      <p className="text-white/70 text-xs mt-1">{remeras.length} productos</p>
                    </div>
                  </Link>
                </FadeIn>
              )}
              {buzos.length > 0 && (
                <FadeIn>
                  <Link href="/productos" className="group block relative aspect-[16/9] overflow-hidden rounded-2xl">
                    <Image
                      src={buzos[0].img !== placeholderImg ? buzos[0].img : 'https://picsum.photos/800/450?random=11'}
                      alt="Buzos"
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <h3 className="font-display text-2xl md:text-3xl text-white">Buzos</h3>
                      <p className="text-white/70 text-xs mt-1">{buzos.length} productos</p>
                    </div>
                  </Link>
                </FadeIn>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ───── SOBRE LUXE ───── */}
      <section className="bg-brand-cream py-16 md:py-20">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center px-6">
            <h2 className="font-display text-2xl md:text-3xl text-neutral-800 mb-4">
              Lüxe Argentina
            </h2>
            <p className="text-neutral-500 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
              Somos un local multimarca en Concordia, Entre Ríos. Seleccionamos las mejores marcas para que encuentres tu estilo sin complicaciones. Envíos a todo el país.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs uppercase tracking-widest text-neutral-400">
              <span>Remeras</span>
              <span className="text-neutral-300">·</span>
              <span>Buzos</span>
              <span className="text-neutral-300">·</span>
              <span>Camisas</span>
              <span className="text-neutral-300">·</span>
              <span>Jeans</span>
              <span className="text-neutral-300">·</span>
              <span>Accesorios</span>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ───── INSTAGRAM CTA ───── */}
      <section className="py-14 md:py-20">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center px-6">
            <h2 className="font-display text-2xl md:text-3xl text-neutral-800 mb-3">
              Seguinos en Instagram
            </h2>
            <p className="text-neutral-400 text-sm mb-6">
              Nuevos ingresos, looks y más en @luxe.arg__
            </p>
            <a
              href="https://www.instagram.com/luxe.arg__/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-neutral-300 text-neutral-700 text-sm uppercase tracking-widest hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              @luxe.arg__
            </a>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
