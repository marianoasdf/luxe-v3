'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { generarUniqueKey, validarCantidad, formatoPrecio, cdnImage } from '@/lib/utils';
import PaymentInfo from '@/components/PaymentInfo';
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

  type BulletItem = { text: string; icon: 'diamond' | 'check' };
  type Block =
    | { type: 'paragraph'; text: string }
    | { type: 'heading'; text: string }
    | { type: 'bullets'; items: BulletItem[] }
    | { type: 'meta'; label: string; value: string }
    | { type: 'spacer' };

  const bulletPattern = /^[•●◦▪■\-*]\s*/;
  const checkPattern = /^[✓✔☑]\s*/;
  const metaPattern = /^([^:]{1,24}):\s*(.+)$/;
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const isBulletLine = (line: string) => bulletPattern.test(line);
  const isCheckLine = (line: string) => checkPattern.test(line);
  const isMetaLine = (line: string) => metaPattern.test(line);
  const getBulletItem = (line: string): BulletItem => ({
    text: line.replace(bulletPattern, '').trim(),
    icon: 'diamond',
  });
  const nextNonBlankIndex = (from: number) => {
    for (let i = from + 1; i < lines.length; i++) {
      if (lines[i]) return i;
    }
    return -1;
  };
  const shouldJoinParagraph = (prev: string, current: string) => {
    if (!prev) return false;
    if (/[.!?]$/.test(prev)) return false;
    if (/^[a-záéíóúñ(]/.test(current)) return true;
    if (prev.length >= 70) return true;
    return false;
  };
  const isHeadingLine = (line: string, index: number, atSectionStart: boolean, previousWasBullets: boolean) => {
    if (!line || isMetaLine(line) || isBulletLine(line) || isCheckLine(line)) return false;
    if (/[.:;]$/.test(line)) return false;
    const nextIndex = nextNonBlankIndex(index);
    const nextLine = nextIndex >= 0 ? lines[nextIndex] : '';
    const nextIsBullet = !!nextLine && (isBulletLine(nextLine) || isCheckLine(nextLine));
    if (index === 0) return line.length <= 70;
    if (nextIsBullet) return line.length <= 70;
    if (previousWasBullets) return line.length <= 45;
    if (atSectionStart) return line.length <= 45;
    return false;
  };

  const blocks: Block[] = [];
  let previousWasBullets = false;
  let atSectionStart = true;
  let paragraphParts: string[] = [];
  let bulletItems: BulletItem[] = [];

  const flushParagraph = () => {
    const value = paragraphParts.join(' ').trim();
    if (value) blocks.push({ type: 'paragraph', text: value });
    paragraphParts = [];
  };

  const flushBullets = () => {
    if (bulletItems.length) blocks.push({ type: 'bullets', items: bulletItems });
    bulletItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      flushParagraph();
      flushBullets();
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'spacer') {
        blocks.push({ type: 'spacer' });
      }
      atSectionStart = true;
      previousWasBullets = false;
      continue;
    }

    if (isCheckLine(line)) {
      flushParagraph();
      flushBullets();
      const content = line.replace(checkPattern, '').trim();
      blocks.push({ type: 'heading', text: `✓ ${content}` });
      atSectionStart = false;
      previousWasBullets = false;
      continue;
    }

    if (isBulletLine(line)) {
      flushParagraph();
      bulletItems.push(getBulletItem(line));
      atSectionStart = false;
      previousWasBullets = true;
      continue;
    }

    flushBullets();

    const metaMatch = line.match(metaPattern);
    if (metaMatch) {
      flushParagraph();
      blocks.push({ type: 'meta', label: metaMatch[1].trim(), value: metaMatch[2].trim() });
      atSectionStart = false;
      previousWasBullets = false;
      continue;
    }

    if (isHeadingLine(line, i, atSectionStart, previousWasBullets)) {
      flushParagraph();
      blocks.push({ type: 'heading', text: line });
      atSectionStart = false;
      previousWasBullets = false;
      continue;
    }

    const prevLine = paragraphParts[paragraphParts.length - 1] || '';
    if (paragraphParts.length && !shouldJoinParagraph(prevLine, line)) {
      flushParagraph();
    }
    paragraphParts.push(line);
    atSectionStart = false;
    previousWasBullets = false;
  }

  flushParagraph();
  flushBullets();
  if (blocks.length && blocks[blocks.length - 1].type === 'spacer') blocks.pop();

  return (
    <div className="text-neutral-500 text-[13.5px] leading-[1.55] tracking-[0.01em]">
      {blocks.map((block, i) => {
        if (block.type === 'spacer')
          return <div key={i} className="h-3" />;
        if (block.type === 'heading') {
          const isCheck = block.text.startsWith('✓');
          const prevIsCheck = i > 0 && blocks[i - 1].type === 'heading' && (blocks[i - 1] as { text: string }).text.startsWith('✓');
          return <p key={i} className={`font-display text-[14.5px] text-neutral-700 ${isCheck && prevIsCheck ? 'mt-0' : 'mt-4'} first:mt-0 mb-0.5 tracking-normal`}>{block.text}</p>;
        }
        if (block.type === 'meta')
          return <p key={i} className="text-neutral-500"><span className="text-neutral-700">{block.label}:</span> {block.value}</p>;
        if (block.type === 'paragraph')
          return <p key={i} className="text-neutral-500">{block.text}</p>;
        return (
          <div key={i} className="mb-1 pl-0.5">
            {block.items.map((item, j) => (
              <p key={j} className="text-neutral-500 flex items-baseline gap-2.5"><span className={item.icon === 'check' ? 'text-brand-accent text-[10px] opacity-80' : 'text-brand-accent text-[8px] opacity-70'}>{item.icon === 'check' ? '✓' : '\u25C8'}</span>{item.text}</p>
            ))}
          </div>
        );
      })}
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
    if (!variants.length) return null;

    const requiereTalle = variants.some((v) => Boolean(getTalleValue(v)));
    const requiereColor = variants.some((v) => Boolean(v.option_values?.color));

    if (requiereTalle && talle == null) return null;
    if (requiereColor && !color) return null;

    return variants.find((v) => {
      const sameTalle = !requiereTalle || getTalleValue(v) === talle;
      const sameColor = !requiereColor || (v.option_values?.color || '') === color;
      return sameTalle && sameColor;
    }) || null;
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

  const sinStockTotal = useMemo(() => {
    if (!variants.length) return false;
    return variants.every((v) => Number(v.stock || 0) <= 0);
  }, [variants]);

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
    // Imagen de la variante o principal
    let img = varianteSeleccionada?.image_url?.trim();
    if (!img) {
      img = Array.isArray(producto?.images) && producto.images.length > 0
        ? producto.images[0]
        : placeholderImg;
    }
    const item = {
      id: producto.id,
      slug: producto.slug,
      name: producto.name,
      desc: producto.desc,
      img,
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
    sinStockTotal ||
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
          <div className="relative aspect-[4/5] overflow-hidden bg-white mb-3">
            <Image
              src={cdnImage(imagenesGaleria[imagenSeleccionada] || placeholderImg)}
              alt={producto.name}
              fill
              className="object-contain"
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
                  <Image src={cdnImage(img)} alt={`${producto.name} - ${idx + 1}`} fill className="object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-neutral-900 mb-3">{producto.name}</h1>
          <p className="text-2xl font-semibold text-neutral-900 mb-4">{formatoPrecio(precioActual)}</p>

            {/* Información de pagos */}
            <PaymentInfo price={precioActual} />

          {sinStockTotal && (
            <p className="text-red-500 text-sm mb-5">Sin stock</p>
          )}

          {/* Size selector */}
          {talleOptions.length > 0 && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-neutral-500 mb-2 block">Talle</label>
              <div className="flex flex-wrap gap-2">
                {talleOptions.map((t) => {
                  const isSelected = talle === t.value;
                  const isDisabled = !t.enabled;
                  const isOutOfStock = t.enabled && !t.hasStock;
                  const isDimmed = sinStockTotal || isDisabled || isOutOfStock;
                  return (
                    <button
                      key={t.value || 'unico'}
                      className={`min-w-[56px] px-3 py-1.5 border text-sm transition relative overflow-hidden ${
                        isSelected && !isOutOfStock
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-900 border-neutral-300 hover:border-neutral-900'
                      }`}
                      style={{ opacity: isDimmed ? 0.4 : 1 }}
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
              {talle == null && !sinStockTotal && <p className="text-sm text-neutral-500 mt-1">Podés elegir un talle primero o seleccionar un color.</p>}
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
              {!color && !sinStockTotal && <p className="text-sm text-neutral-500 mt-1">Seleccioná un color para ver disponibilidad y comprar.</p>}
            </div>
          )}

          {/* Quantity / Out of stock */}
          {sinStockTotal ? (
            null
          ) : stockActual === 0 && varianteSeleccionada ? (
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

          {/* Description */}
          {producto.desc && (
            <div className="mt-8 pt-6 border-t border-neutral-200/60">
              <ProductDescription text={producto.desc} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
