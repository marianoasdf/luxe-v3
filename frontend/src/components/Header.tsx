'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { cdnImage, formatTalle, formatoPrecio } from '@/lib/utils';
import { useTransferDiscount } from '@/lib/transferDiscount';

const cartImageFallback = 'https://picsum.photos/120/120?grayscale&blur=1';

export default function Header() {
  const { user, logout } = useAuth();
  const {
    carrito,
    aumentarCantidad,
    disminuirCantidad,
    eliminarDelCarrito,
    vaciarCarrito,
    total,
    openCartTick,
  } = useCart();

  const pathname = usePathname();
  const isHome = pathname === '/';
  const loginHref = `/login?from=${encodeURIComponent(pathname)}`;

  const [showMenu, setShowMenu] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (openCartTick > 0) setShowCart(true);
  }, [openCartTick]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setShowCart(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const transferDiscount = useTransferDiscount();
  const transferPromo = transferDiscount !== null && transferDiscount > 0 ? (
    <>
      <span className="mx-2 text-[#7a5c2e]">|</span>
      <span role="img" aria-label="Transferencia">💸</span>
      {transferDiscount}% OFF con transferencia
    </>
  ) : null;

  const tickerRef = useRef<HTMLDivElement>(null);
  // --- PROMO TICKER ---
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;
    let frame: number;
    let lastTime = performance.now();
    let scroll = ticker.scrollLeft;
    let blockWidth = 0;
    // Medir el ancho real del primer bloque
    const track = ticker.firstElementChild as HTMLElement | null;
    if (!track || track.children.length === 0) return;
    const firstBlock = track.children[0] as HTMLElement | null;
    if (!firstBlock) return;
    blockWidth = firstBlock.offsetWidth;
    if (!blockWidth) return;
    // Velocidad en px/seg (ajustable)
    const SPEED = 60; // px/seg
    function animate(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // segundos, máx 50ms/frame
      lastTime = now;
      scroll += SPEED * dt;
      // Loop seamless: cuando supera el ancho del primer bloque, restar ese ancho
      if (scroll >= blockWidth) {
        // Evitar acumulación de error flotante
        scroll -= blockWidth;
      }
      ticker!.scrollLeft = scroll;
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // El porcentaje viene resuelto desde el servidor en el primer render; solo cambia si el admin
    // lo edita en esta misma sesión, en cuyo caso hay que re-medir el ancho del bloque.
  }, [transferDiscount]);

  const navContent = (
      <div className="relative max-w-7xl mx-auto flex h-full items-center justify-between px-4 md:px-8">
        {/* Left: Burger (mobile) + Logo (desktop) + Nav */}
        <div className="flex items-center gap-8">
          {/* Mobile burger */}
          <button
            className="md:hidden p-2 hover:bg-neutral-100 rounded-full transition-colors duration-300"
            aria-label="Menú"
            onClick={() => setShowMenu(true)}
          >
            <svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <Link href="/" className="hidden md:block leading-none select-none" style={{WebkitTapHighlightColor:'transparent'}}>
            <span className="flex flex-col items-start gap-[0.2rem]" aria-label="Lüxe Argentina">
              <span className="font-display text-[2.2rem] tracking-[-0.04em] text-neutral-900 leading-none">Lüxe</span>
              <span className="self-stretch h-px bg-neutral-300" />
              <span className="font-display text-[0.65rem] uppercase tracking-[0.35em] text-neutral-400 leading-none">argentina</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/productos" className="text-sm uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors duration-300">
              Shop
            </Link>
            <Link href="/contacto" className="text-sm uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors duration-300">
              Contacto
            </Link>
          </div>
        </div>

        {/* Mobile centered logo */}
        <Link href="/" className="md:hidden absolute left-1/2 -translate-x-1/2 leading-none select-none" style={{WebkitTapHighlightColor:'transparent'}}>
          <span className="flex flex-col items-center gap-[0.18rem]" aria-label="Lüxe Argentina">
            <span className="font-display text-[2rem] tracking-[-0.04em] text-neutral-900 leading-none">Lüxe</span>
            <span className="self-stretch h-px bg-neutral-300" />
            <span className="font-display text-[0.62rem] uppercase tracking-[0.35em] text-neutral-400 leading-none">argentina</span>
          </span>
        </Link>

        {/* Right: Auth + Cart */}
        <div className="flex items-center gap-4">
          {mounted && (user ? (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/mi-cuenta" className="text-xs uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition-colors duration-300">
                Mi cuenta
              </Link>
              <button
                onClick={logout}
                className="text-xs uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition-colors duration-300 bg-transparent border-none cursor-pointer"
              >
                Salir
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-4">
              <Link href={loginHref} className="text-xs uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition-colors duration-300">
                Ingresar
              </Link>
              <Link href="/register" className="text-xs uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition-colors duration-300">
                Crear cuenta
              </Link>
            </div>
          ))}

          {/* Cart button */}
          <button
            className="relative p-2 hover:bg-neutral-100 rounded-full transition-colors duration-300"
            onClick={() => setShowCart(true)}
            aria-label="Carrito"
          >
            <svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {mounted && carrito.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-neutral-900 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                {carrito.length}
              </span>
            )}
          </button>
        </div>
      </div>
  );

  const offcanvasContent = <>
      {/* Mobile menu offcanvas */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setShowMenu(false)} />
          <div className="fixed top-0 left-0 h-full w-[min(20rem,calc(100vw-1rem))] max-w-full bg-white z-[70] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <span className="flex flex-col items-start gap-[0.18rem]" aria-label="Lüxe Argentina">
                <span className="font-display text-[1.9rem] tracking-[-0.04em] text-neutral-900 leading-none">Lüxe</span>
                <span className="self-stretch h-px bg-neutral-200" />
                <span className="font-display text-[0.58rem] uppercase tracking-[0.35em] text-neutral-400 leading-none">argentina</span>
              </span>
              <button
                onClick={() => setShowMenu(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-1 p-6">
              <Link
                href="/"
                className="py-3 text-neutral-900 uppercase text-sm tracking-widest font-light hover:text-neutral-500 transition-colors"
                onClick={() => setShowMenu(false)}
              >
                Inicio
              </Link>
              <Link
                href="/productos"
                className="py-3 text-neutral-900 uppercase text-sm tracking-widest font-light hover:text-neutral-500 transition-colors"
                onClick={() => setShowMenu(false)}
              >
                Shop
              </Link>
              <Link
                href="/contacto"
                className="py-3 text-neutral-900 uppercase text-sm tracking-widest font-light hover:text-neutral-500 transition-colors"
                onClick={() => setShowMenu(false)}
              >
                Contacto
              </Link>
            </div>
            <div className="mt-auto p-6 border-t border-neutral-100">
              {user ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-neutral-500 uppercase tracking-wider">
                    {user.nombre || user.email}
                  </span>
                  <Link
                    href="/mi-cuenta"
                    className="text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    Mi cuenta
                  </Link>
                  <button
                    onClick={() => { logout(); setShowMenu(false); }}
                    className="text-sm text-neutral-700 hover:text-neutral-900 transition-colors bg-transparent border-none cursor-pointer p-0 text-left"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href={loginHref}
                    className="text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    Ingresar
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    Crear cuenta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Cart offcanvas */}
      {showCart && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setShowCart(false)} />
          <div className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-[70] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-900">
                Carrito ({carrito.length})
              </h3>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-16 h-16 text-neutral-200 mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <p className="text-neutral-400 text-sm">Tu carrito está vacío</p>
                  <button
                    onClick={() => setShowCart(false)}
                    className="mt-4 text-xs uppercase tracking-widest text-neutral-900 border-b border-neutral-900 pb-0.5 hover:text-neutral-600 hover:border-neutral-600 transition-colors"
                  >
                    Seguir comprando
                  </button>
                </div>
              ) : (
                <ul className="space-y-6">
                  {carrito.map((item) => (
                    <li key={item.uniqueKey} className="flex gap-4">
                      <Link
                        href={`/producto/${item.slug}`}
                        className="relative h-24 w-20 shrink-0 overflow-hidden bg-neutral-100"
                        onClick={() => setShowCart(false)}
                      >
                        <Image
                          src={cdnImage(item.img || cartImageFallback)}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/producto/${item.slug}`}
                          className="block text-sm font-medium text-neutral-900 truncate hover:text-neutral-600 transition-colors"
                          onClick={() => setShowCart(false)}
                        >
                          {item.name}
                        </Link>
                        {(() => {
                          const talleLabel = formatTalle(item.talle);
                          const colorLabel = item.color?.trim() ? item.color : null;
                          if (!talleLabel && !colorLabel) return null;
                          return (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {talleLabel && `Talle: ${talleLabel}`}
                          {talleLabel && colorLabel && ' · '}
                          {colorLabel && `Color: ${colorLabel}`}
                        </p>
                          );
                        })()}
                        <p className="text-sm font-medium text-neutral-900 mt-1">{formatoPrecio(item.price)}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            className="w-7 h-7 flex items-center justify-center border border-neutral-200 rounded text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                            onClick={() => disminuirCantidad(item.uniqueKey)}
                          >
                            −
                          </button>
                          <span className="text-sm font-medium w-4 text-center">{item.cantidad}</span>
                          <button
                            className="w-7 h-7 flex items-center justify-center border border-neutral-200 rounded text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                            onClick={() => aumentarCantidad(item.uniqueKey)}
                          >
                            +
                          </button>
                          <button
                            className="ml-auto text-xs text-neutral-400 hover:text-neutral-900 transition-colors underline"
                            onClick={() => eliminarDelCarrito(item.uniqueKey)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {carrito.length > 0 && (
              <div className="p-6 border-t border-neutral-100 space-y-4">
                {/* Free shipping progress */}
                {(() => {
                  const FREE_SHIPPING_THRESHOLD = 150000;
                  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
                  const progress = Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100);
                    
                  if (total >= FREE_SHIPPING_THRESHOLD) {
                    return (
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="flex items-center gap-2 text-green-700">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">¡Envío gratis!</span>
                        </div>
                        <p className="text-green-600 text-xs mt-1">
                          Envío gratis en compras superiores a $150.000
                        </p>
                      </div>
                    );
                  }
                    
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <div className="flex items-center gap-2 text-amber-700">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                        </svg>
                        <span className="text-sm font-medium">¡Envío gratis!</span>
                      </div>
                      <p className="text-amber-600 text-xs mt-1">
                        Te faltan {formatoPrecio(remaining)} para el envío gratis
                      </p>
                      <div className="mt-2 bg-amber-200 rounded-full h-1.5">
                        <div 
                          className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wider text-neutral-500">Total</span>
                  <span className="text-lg font-semibold text-neutral-900">{formatoPrecio(total)}</span>
                </div>
                <Link
                  href="/checkout"
                  className="block w-full bg-neutral-900 text-white text-center py-3.5 text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors duration-300 rounded-none"
                  onClick={() => setShowCart(false)}
                >
                  Finalizar compra
                </Link>
                <button
                  className="w-full text-xs text-center uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition-colors bg-transparent border-none cursor-pointer py-2"
                  onClick={vaciarCarrito}
                >
                  Vaciar carrito
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>;

  return (
    <>
      {/* Header fijo superior promos */}
      {/* Mobile: ticker */}
      <div className="fixed top-0 left-0 right-0 z-[60] w-full bg-[#fcf7ef]/95 backdrop-blur-sm">
        <div className="md:hidden h-8 overflow-hidden" ref={tickerRef}>
          <div className="flex h-8 w-max whitespace-nowrap">
            {/* Contenido duplicado para loop */}
            <>
              <span className="text-[13px] text-[#7a5c2e] font-light flex items-center gap-2 select-none px-2">
                <span role="img" aria-label="Tarjeta">💳</span>
                3 cuotas sin interés
                {transferPromo}
                <span className="mx-2 text-[#7a5c2e]">|</span>
                <span role="img" aria-label="Camión">🚚</span>
                Envíos gratis desde $150.000
              </span>
              <span className="text-[13px] text-[#7a5c2e] font-light flex items-center gap-2 select-none px-2">
                <span role="img" aria-label="Tarjeta">💳</span>
                3 cuotas sin interés
                {transferPromo}
                <span className="mx-2 text-[#7a5c2e]">|</span>
                <span role="img" aria-label="Camión">🚚</span>
                Envíos gratis desde $150.000
              </span>
            </>
          </div>
        </div>
        {/* Desktop: igual que antes */}
        <div className="hidden md:flex items-center justify-center h-8 px-2 md:px-0">
          <span className="text-[13px] text-[#7a5c2e] font-light flex items-center gap-2 select-none">
            <span role="img" aria-label="Tarjeta">💳</span>
            3 cuotas sin interés
            {transferPromo}
            <span className="mx-2 text-[#7a5c2e]">|</span>
            <span role="img" aria-label="Camión">🚚</span>
            Envíos gratis desde $150.000
          </span>
        </div>
      </div>
      <nav
        className={`fixed top-8 left-0 right-0 z-50 h-16 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-md shadow-sm'
            : 'bg-white/45 backdrop-blur-sm'
        }`}
      >
        {navContent}
      </nav>
      {!isHome && <div aria-hidden="true" className="h-24" />}
      {offcanvasContent}
    </>
  );
}
