'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { formatoPrecio } from '@/lib/utils';

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

  const [showMenu, setShowMenu] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    if (openCartTick > 0) setShowCart(true);
  }, [openCartTick]);

  // Close menus on Escape
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-gray-900 text-white">
      <div className="relative flex h-full items-center justify-between px-2">
        {/* Left: burger + desktop nav */}
        <div className="flex items-center gap-3 h-full">
          <button
            className="md:hidden flex items-center gap-2 bg-transparent border-none"
            aria-label="Menú"
            onClick={() => setShowMenu(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-xs font-light uppercase tracking-wider">Menú</span>
          </button>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/" className="text-white hover:text-gray-300 text-sm">Inicio</Link>
            <Link href="/productos" className="text-white hover:text-gray-300 text-sm">Productos</Link>
            <Link href="/contacto" className="text-white hover:text-gray-300 text-sm">Contacto</Link>
          </div>
        </div>

        {/* Center: logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link href="/" className="text-xl font-normal whitespace-nowrap">Luxe 👕</Link>
        </div>

        {/* Right: auth links + cart */}
        <div className="flex items-center gap-2 h-full">
          {user ? (
            <>
              <span className="hidden md:inline text-sm font-light">Hola, {user.nombre || user.email}</span>
              <Link href="/mi-cuenta" className="hidden md:inline text-sm font-light hover:text-gray-300">Mi cuenta</Link>
              <span className="hidden md:inline text-gray-400">|</span>
              <button
                onClick={logout}
                className="hidden md:inline text-sm font-light hover:text-gray-300 bg-transparent border-none cursor-pointer text-white"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/register" className="hidden md:inline text-sm font-light hover:text-gray-300">Crear cuenta</Link>
              <span className="hidden md:inline text-gray-400">|</span>
              <Link href="/login" className="hidden md:inline text-sm font-light hover:text-gray-300">Iniciar sesión</Link>
            </>
          )}

          <button
            className="bg-transparent border-none cursor-pointer p-1"
            onClick={() => setShowCart(true)}
            aria-label="Carrito"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61l1.38-7.39H6" />
            </svg>
            {carrito.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {carrito.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu offcanvas */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowMenu(false)} />
          <div className="fixed top-0 left-0 h-full w-72 bg-white z-[70] shadow-xl flex flex-col">
            <div className="flex justify-end p-4">
              <button onClick={() => setShowMenu(false)} className="text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex flex-col gap-4 px-6">
              <Link href="/" className="text-gray-800 uppercase text-sm tracking-wider font-light" onClick={() => setShowMenu(false)}>Inicio</Link>
              <Link href="/productos" className="text-gray-800 uppercase text-sm tracking-wider font-light" onClick={() => setShowMenu(false)}>Productos</Link>
              <Link href="/contacto" className="text-gray-800 uppercase text-sm tracking-wider font-light" onClick={() => setShowMenu(false)}>Contacto</Link>
            </div>
            <div className="mt-auto p-6 border-t flex flex-wrap items-center gap-2 text-sm md:hidden">
              {user ? (
                <>
                  <span className="text-gray-800">Hola, {user.nombre || user.email}</span>
                  <span className="text-gray-400">|</span>
                  <Link href="/mi-cuenta" className="text-gray-800" onClick={() => setShowMenu(false)}>Mi cuenta</Link>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={() => { logout(); setShowMenu(false); }}
                    className="text-gray-800 bg-transparent border-none cursor-pointer p-0"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/register" className="text-gray-800" onClick={() => setShowMenu(false)}>Crear cuenta</Link>
                  <span className="text-gray-400">|</span>
                  <Link href="/login" className="text-gray-800" onClick={() => setShowMenu(false)}>Iniciar sesión</Link>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Cart offcanvas */}
      {showCart && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowCart(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-[70] shadow-xl flex flex-col text-gray-900">
            <div className="flex justify-end p-4">
              <button onClick={() => setShowCart(false)} className="text-gray-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4">
              <h3 className="text-lg font-semibold mb-4">Carrito de compras 🛒</h3>
              {carrito.length === 0 ? (
                <p className="text-center text-gray-500">Tu carrito está vacío 😢</p>
              ) : (
                <ul className="space-y-3">
                  {carrito.map((item) => (
                    <li key={item.uniqueKey} className="border-b pb-3">
                      <div>
                        <strong>{item.name}</strong>
                        <div className="text-sm text-gray-500">Talle: {item.talle} | Color: {item.color}</div>
                        <div className="text-sm">{formatoPrecio(item.price)} x {item.cantidad}</div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          className="px-2 py-1 border rounded text-sm hover:bg-gray-100"
                          onClick={() => disminuirCantidad(item.uniqueKey)}
                        >
                          -
                        </button>
                        <button
                          className="px-2 py-1 border rounded text-sm hover:bg-gray-100"
                          onClick={() => aumentarCantidad(item.uniqueKey)}
                        >
                          +
                        </button>
                        <button
                          className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                          onClick={() => eliminarDelCarrito(item.uniqueKey)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {carrito.length > 0 && (
              <div className="p-4 border-t space-y-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span>{formatoPrecio(total)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/checkout"
                    className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                    onClick={() => setShowCart(false)}
                  >
                    Confirmar compra
                  </Link>
                  <button
                    className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600"
                    onClick={vaciarCarrito}
                  >
                    Vaciar
                  </button>
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                    onClick={() => setShowCart(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  );
}
