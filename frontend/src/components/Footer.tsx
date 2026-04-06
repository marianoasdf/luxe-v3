import Link from 'next/link';

const PAYMENT_METHODS = [
  { name: 'Visa', src: 'https://http2.mlstatic.com/storage/logos-api-admin/d589be70-eb86-11e9-b9a8-097ac027487d-xl@2x.png' },
  { name: 'Mastercard', src: 'https://http2.mlstatic.com/storage/logos-api-admin/0daa1670-5c81-11ec-ae75-df2bef173be2-xl@2x.png' },
  { name: 'American Express', src: 'https://http2.mlstatic.com/storage/logos-api-admin/b08cf800-4c1a-11e9-9888-a566cbf302df-xl@2x.png' },
  { name: 'Maestro', src: 'https://http2.mlstatic.com/storage/logos-api-admin/ce454480-445f-11eb-bf78-3b1ee7bf744c-xl@2x.png' },
  { name: 'Naranja', src: 'https://http2.mlstatic.com/storage/logos-api-admin/af139ad0-d705-11ee-8925-8314c09d1640-xl@2x.png' },
  { name: 'Cabal', src: 'https://http2.mlstatic.com/storage/logos-api-admin/8a6e52e0-199a-11f1-a055-c93b389430dc-l-r2x.png' },
  { name: 'Diners', src: 'https://http2.mlstatic.com/storage/logos-api-admin/751ea930-571a-11e8-9a2d-4b2bd7b1bf77-xl@2x.png' },
  { name: 'Argencard', src: 'https://http2.mlstatic.com/storage/logos-api-admin/d7e55980-f3be-11eb-8e0d-6f4af49bf82e-xl@2x.png' },
  { name: 'Pago Fácil', src: 'https://www.mercadopago.com/org-img/MP3/API/logos/pagofacil.gif' },
  { name: 'Rapipago', src: 'https://www.mercadopago.com/org-img/MP3/API/logos/rapipago.gif' },
];

export default function Footer() {
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      {/* Trust badges */}
      <div className="border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <svg className="w-6 h-6 mx-auto mb-3 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <p className="text-xs uppercase tracking-widest text-white font-medium mb-1">Envíos a todo el país</p>
            <p className="text-xs text-neutral-500">Tu pedido en la puerta de tu casa</p>
          </div>
          <div>
            <svg className="w-6 h-6 mx-auto mb-3 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            <p className="text-xs uppercase tracking-widest text-white font-medium mb-1">3 cuotas sin interés</p>
            <p className="text-xs text-neutral-500">Con todas las tarjetas</p>
          </div>
          <div>
            <svg className="w-6 h-6 mx-auto mb-3 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
            </svg>
            <p className="text-xs uppercase tracking-widest text-white font-medium mb-1">Cambios y devoluciones</p>
            <p className="text-xs text-neutral-500">30 días para tu cambio</p>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex flex-col md:flex-row md:justify-start md:items-start">
          {/* Brand */}
                    <div>
            <p className="font-display text-xl text-white mb-3">Lüxe</p>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-sm">
              Local multimarca en Concordia, Entre Ríos.
              Marcas seleccionadas para tu estilo de todos los días.
            </p>
            <p className="text-xs text-neutral-600 mt-3">
              Las Palmas 1546, Concordia, Entre Ríos
            </p>
            <div className="flex gap-4 mt-6">
              <a
                href="https://www.instagram.com/luxe.arg__/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-500 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Medios de pago */}
                    <div className="flex flex-col items-start md:ml-32">
            <p className="text-xs uppercase tracking-widest text-white font-medium mb-4">Medios de pago</p>
            <div className="grid grid-cols-4 gap-[6px]">
              {PAYMENT_METHODS.map((card) => (
                <div
                  key={card.name}
                  title={card.name}
                  className="w-[46px] h-[32px] bg-white rounded-[2px] flex items-center justify-center"
                >
                  <img
                    src={card.src}
                    alt={card.name}
                    className="w-[38px] h-[24px] object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
                    <div className="md:w-1/4 md:ml-auto md:-mr-8">
            <p className="text-xs uppercase tracking-widest text-white font-medium mb-4">Tienda</p>
            <ul className="space-y-2.5">
              <li><Link href="/productos" className="text-sm text-neutral-500 hover:text-white transition-colors">Shop</Link></li>
              <li><Link href="/contacto" className="text-sm text-neutral-500 hover:text-white transition-colors">Contacto</Link></li>
              <li>
                <a href="https://wa.me/5493454161528" target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-500 hover:text-white transition-colors">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-[11px] text-neutral-600">
            &copy; {new Date().getFullYear()} Lüxe Argentina. Todos los derechos reservados.
          </p>
          <p className="text-[11px] text-neutral-600">
            <a
              href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-400 transition-colors underline"
            >
              Defensa del consumidor
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
