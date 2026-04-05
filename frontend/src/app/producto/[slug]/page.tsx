'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { generarUniqueKey, validarCantidad, formatoPrecio, cdnImage } from '@/lib/utils';
import type { VariantRow } from '@/types';

interface ProductDetail {
  id: number;
  slug: string;
  name: string;
  desc: string;
  images: string[];
  price: number;
}

interface TalleOption {
  value: string;
  hasStock: boolean;
  enabled: boolean;
}

interface ColorOption {
  value: string;
  hasStock: boolean;
  matchesSelectedSize: boolean;
}

const placeholderImg = 'https://picsum.photos/800/800?grayscale&blur=1';
const getTalleValue = (variant: VariantRow): string => variant.option_values?.talle ?? '';

const SIZE_ORDER = new Map<string, number>([
  ['XXS', 0], ['XS', 1], ['S', 2], ['M', 3], ['L', 4], ['XL', 5], ['XXL', 6], ['XXXL', 7],
]);

function sortTalles(a: TalleOption, b: TalleOption): number {
  const aRaw = a.value ?? '';
  const bRaw = b.value ?? '';
  if (!aRaw && bRaw) return 1;
  if (!bRaw && aRaw) return -1;
  const aNorm = aRaw.trim().toUpperCase();
  const bNorm = bRaw.trim().toUpperCase();
  const aTxt = SIZE_ORDER.get(aNorm);
  const bTxt = SIZE_ORDER.get(bNorm);
  if (aTxt != null && bTxt != null) return aTxt - bTxt;
  if (aTxt != null) return -1;
  if (bTxt != null) return 1;
  const aNum = Number(aNorm.replace(',', '.'));
  const bNum = Number(bNorm.replace(',', '.'));
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  if (Number.isFinite(aNum)) return -1;
  if (Number.isFinite(bNum)) return 1;
  return aNorm.localeCompare(bNorm, 'es', { numeric: true, sensitivity: 'base' });
}

function ProductDescription({ text }: { text: string }) {
  if (!text) return null;

  // Split by "•" or "\n" to detect bullet items
  const parts = text.split(/\s*[•]\s*/);
  const intro = parts[0]?.trim();
  const bullets = parts.slice(1).map((b) => b.trim()).filter(Boolean);

  if (!bullets.length) {
    // No bullets — render paragraphs split by newlines
    const paragraphs = text.split(/\n+/).filter(Boolean);
    return (
      <div className="text-neutral-500 text-sm mb-4 space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="text-neutral-500 text-sm mb-4 space-y-3">
      {intro && <p>{intro}</p>}
      <ul className="space-y-1.5 pl-1">
        {bullets.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProductoDetallePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { agregarAlCarrito, triggerOpenCart } = useCart();

  const [producto, setProducto] = useState<ProductDetail | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [talle, setTalle] = useState<string | null>(null);
  const [color, setColor] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [imagenSeleccionada, setImagenSeleccionada] = useState(0);

  useEffect(() => {
    let abort = false;
    async function fetchDetail() {
      try {
        setLoading(true);
        const res = await fetch(`/api/products/${slug}`);
        if (!res.ok) throw new Error('No se pudo cargar el producto');
        const data = await res.json();
        const p = data.product;
        const v: VariantRow[] = data.variants || [];
        if (abort) return;
        setProducto({
          id: p.id,
          slug: p.slug,
          name: p.name,
          desc: p.description || '',
          images: (Array.isArray(p.images) && p.images.map((img: { url?: string } | string) =>
            typeof img === 'string' ? img : img.url || '',
          )) || [placeholderImg],
          price: Number(p.price || 0),
        });
        setImagenSeleccionada(0);
        setVariants(v);
        setColor('');
        setTalle(null);
        setCantidad(1);
      } catch (e) {
        if (!abort) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!abort) setLoading(false);
      }
    }
    fetchDetail();
    return () => { abort = true; };
  }, [slug]);

  const handleColorChange = (nuevoColor: string) => {
    if (!nuevoColor) {
      setColor('');
      setTalle(null);
      setImagenSeleccionada(0);
      return;
    }
    const variantsColor = variants.filter((v) => v.option_values?.color === nuevoColor);
    if (!variantsColor.length) {
      setColor('');
      setTalle(null);
      return;
    }
    setColor(nuevoColor);
    const talleActualValido = talle != null && variantsColor.some((v) => getTalleValue(v) === talle);
    if (!talleActualValido) {
      setTalle(null);
      const tallesForColor = [...new Set(variantsColor.map((v) => getTalleValue(v).trim()))];
      const unicoTalle = tallesForColor.length === 1 ? tallesForColor[0] : null;
      if (unicoTalle === '' || /^unico$/i.test(unicoTalle || '')) {
        setTalle('');
      }
    }
    const imageUrlsColor = Array.from(new Set(variantsColor.map((v) => v.image_url).filter(Boolean)));
    if (!imageUrlsColor.length) return;
    const galleryImages = imagenesGaleria;
    const idx = galleryImages.findIndex((img) => imageUrlsColor.includes(img));
    if (idx >= 0) setImagenSeleccionada(idx);
  };

  const handleTalleChange = (nuevoTalle: string) => {
    const variantsTalle = variants.filter((v) => getTalleValue(v) === nuevoTalle);
    if (!variantsTalle.length) {
      setTalle(null);
      setColor('');
      return;
    }
    setTalle(nuevoTalle);
    const colorActualValido = variantsTalle.some((v) => (v.option_values?.color || '') === color);
    if (!colorActualValido) setColor('');
  };

  const talleOptions = useMemo((): TalleOption[] => {
    const map = new Map<string, TalleOption>();
    for (const v of variants) {
      const key = getTalleValue(v);
      if (!map.has(key)) {
        map.set(key, { value: key, hasStock: false, enabled: !color });
      }
      const prev = map.get(key)!;
      const matchesColor = !color || v.option_values?.color === color;
      if (matchesColor && Number(v.stock || 0) > 0) prev.hasStock = true;
      if (color && v.option_values?.color === color) prev.enabled = true;
    }
    return Array.from(map.values()).sort(sortTalles);
  }, [variants, color]);

  const colorOptions = useMemo((): ColorOption[] => {
    const map = new Map<string, ColorOption>();
    for (const v of variants) {
      const key = v.option_values?.color;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { value: key, hasStock: false, matchesSelectedSize: talle == null });
      }
      const prev = map.get(key)!;
      if (Number(v.stock || 0) > 0) prev.hasStock = true;
      if (talle != null && getTalleValue(v) === talle) prev.matchesSelectedSize = true;
    }
    return Array.from(map.values());
  }, [variants, talle]);

  const precioActual = useMemo(() => {
    const variante = variants.find(
      (v) => getTalleValue(v) === talle && v.option_values?.color === color,
    );
    if (variante && variante.price != null) return Number(variante.price);
    return producto ? Number(producto.price) : 0;
  }, [variants, talle, color, producto]);

  const varianteSeleccionada = useMemo(() => {
    if (!variants.length || !color) return null;
    return variants.find(
      (v) => getTalleValue(v) === talle && v.option_values?.color === color,
    ) || null;
  }, [variants, talle, color]);

  const imagenesGaleria = useMemo(() => {
    const variantImages = Array.from(new Set(variants.map((v) => v.image_url).filter(Boolean))) as string[];
    if (variantImages.length) return variantImages;
    const base = Array.isArray(producto?.images) ? producto.images.filter(Boolean) : [];
    const all = Array.from(new Set(base));
    return all.length ? all : [placeholderImg];
  }, [producto, variants]);

  const stockActual = useMemo((): number | null => {
    if (!varianteSeleccionada) return null;
    const n = Number(varianteSeleccionada.stock);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [varianteSeleccionada]);

  useEffect(() => {
    if (stockActual != null && stockActual > 0 && Number(cantidad) > stockActual) {
      setCantidad(stockActual);
    }
  }, [stockActual, cantidad]);

  useEffect(() => {
    if (imagenSeleccionada >= imagenesGaleria.length) setImagenSeleccionada(0);
  }, [imagenSeleccionada, imagenesGaleria.length]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-16 text-neutral-500">Cargando…</div>;
  if (error) return <div className="max-w-7xl mx-auto px-4 py-16 text-red-600">{error}</div>;
  if (!producto) return <div className="max-w-7xl mx-auto px-4 py-16 text-neutral-500">Producto no encontrado</div>;

  const handleAgregar = () => {
    if (colorOptions.length > 0 && !color) { alert('Seleccioná un color para continuar.'); return; }
    if (talleOptions.length > 0 && talle == null) { alert('Seleccioná un talle para continuar.'); return; }
    if (stockActual != null && stockActual <= 0) { alert('Esta variante no tiene stock disponible.'); return; }
    const cantidadNormalizada = validarCantidad(cantidad);
    const cantidadFinal = stockActual != null ? Math.min(cantidadNormalizada, stockActual) : cantidadNormalizada;
    const item = {
      id: producto.id,
      slug: producto.slug,
      name: producto.name,
      desc: producto.desc,
      img: imagenesGaleria[imagenSeleccionada] || placeholderImg,
      price: precioActual,
      variant_id: varianteSeleccionada?.id || null,
      talle,
      color,
      stock: stockActual,
      cantidad: cantidadFinal,
      uniqueKey: '',
    };
    item.uniqueKey = generarUniqueKey(item);
    agregarAlCarrito(item);
    triggerOpenCart();
  };

  const disminuirCantidadLocal = () => setCantidad((prev) => Math.max(1, validarCantidad(prev) - 1));
  const aumentarCantidadLocal = () =>
    setCantidad((prev) => {
      const next = validarCantidad(prev) + 1;
      return stockActual != null ? Math.min(next, stockActual) : next;
    });

  const disableAdd =
    (colorOptions.length > 0 && !color) ||
    (talleOptions.length > 0 && talle == null) ||
    stockActual === 0;

  const ctaText =
    !color && colorOptions.length > 0
      ? 'Elegí un color para comprar'
      : talle == null && talleOptions.length > 0
        ? 'Elegí un talle para comprar'
        : 'Agregar al carrito';

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden bg-neutral-100 mb-3">
            <Image
              src={cdnImage(imagenesGaleria[imagenSeleccionada] || placeholderImg)}
              alt={producto.name}
              fill
              className="object-cover"
              priority
            />
          </div>
          {imagenesGaleria.length > 1 && (
            <div className="flex gap-2">
              {imagenesGaleria.map((img, idx) => (
                <button
                  key={idx}
                  className={`relative w-20 h-20 overflow-hidden border-2 transition ${
                    imagenSeleccionada === idx ? 'border-neutral-900 opacity-100' : 'border-transparent opacity-60 hover:opacity-80'
                  }`}
                  onClick={() => setImagenSeleccionada(idx)}
                >
                  <Image src={cdnImage(img)} alt={`${producto.name} - ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-neutral-900 mb-2">{producto.name}</h1>
          <ProductDescription text={producto.desc} />
          <p className="text-2xl font-semibold text-neutral-900 mb-6">{formatoPrecio(precioActual)}</p>

          {/* Size selector */}
          {talleOptions.length > 0 && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-neutral-500 mb-2 block">Talle</label>
              <div className="flex flex-wrap gap-2">
                {talleOptions.map((t) => {
                  const isSelected = talle === t.value;
                  const isDisabled = !t.enabled;
                  const isOutOfStock = Boolean(color) && t.enabled && !t.hasStock;
                  return (
                    <button
                      key={t.value || 'unico'}
                      className={`min-w-[56px] px-3 py-1.5 border text-sm transition relative overflow-hidden ${
                        isSelected
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-900 border-neutral-300 hover:border-neutral-900'
                      }`}
                      style={{ opacity: isDisabled ? 0.4 : 1 }}
                      onClick={() => handleTalleChange(t.value)}
                      title={!t.enabled ? 'No disponible' : isOutOfStock ? 'Sin stock' : t.value || 'Único'}
                    >
                      <span className="relative z-10">{t.value || 'Único'}</span>
                      {isOutOfStock && (
                        <span
                          className="absolute left-[-18%] top-1/2 w-[136%] border-t border-current -rotate-[33deg] origin-center pointer-events-none opacity-95"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {talle == null && <p className="text-sm text-neutral-500 mt-1">Podés elegir un talle primero o seleccionar un color.</p>}
            </div>
          )}

          {/* Color selector */}
          {colorOptions.length > 0 && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-neutral-500 mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((c) => {
                  const isSelected = color === c.value;
                  const isDimmed = talle != null && !c.matchesSelectedSize;
                  return (
                    <button
                      key={c.value}
                      className={`px-3 py-1.5 border text-sm transition ${
                        isSelected
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-900 border-neutral-300 hover:border-neutral-900'
                      }`}
                      style={{ opacity: isDimmed ? 0.45 : 1 }}
                      onClick={() => handleColorChange(c.value)}
                      title={!c.matchesSelectedSize ? 'No disponible con el talle actual' : c.value}
                    >
                      {c.value}
                    </button>
                  );
                })}
              </div>
              {!color && <p className="text-sm text-neutral-500 mt-1">Seleccioná un color para ver disponibilidad y comprar.</p>}
            </div>
          )}

          {/* Quantity / Out of stock */}
          {stockActual === 0 && varianteSeleccionada ? (
            <p className="text-red-500 text-sm mb-4">Sin stock para esta combinación.</p>
          ) : (
            <div className="mb-6">
              <label className="text-xs uppercase tracking-wider text-neutral-500 mb-2 block">Cantidad</label>
              <div className="flex items-center gap-3">
                <button
                  className="w-9 h-9 border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-40"
                  onClick={disminuirCantidadLocal}
                  disabled={cantidad <= 1}
                >
                  -
                </button>
                <span className="w-12 text-center font-medium">{cantidad}</span>
                <button
                  className="w-9 h-9 border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-40"
                  onClick={aumentarCantidadLocal}
                  disabled={stockActual != null ? cantidad >= stockActual : false}
                >
                  +
                </button>
              </div>
              {stockActual != null && stockActual > 0 && stockActual <= 5 && (
                <p className="text-amber-600 text-sm mt-1">Quedan solo {stockActual} unidades.</p>
              )}
            </div>
          )}

          <button
            className="w-full bg-neutral-900 text-white py-3.5 text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAgregar}
            disabled={disableAdd}
          >
            {ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}
