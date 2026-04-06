export default function ContactoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
      <h1 className="font-display text-2xl md:text-3xl text-neutral-900 text-center mb-10">Contacto</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-2">WhatsApp</h3>
            <a
              href="https://wa.me/5493454161528"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-900 hover:text-neutral-600 transition-colors text-sm"
            >
              +54 9 345 416-1528
            </a>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-2">Email</h3>
            <a
              href="mailto:contacto@luxeargentina.com"
              className="text-neutral-900 hover:text-neutral-600 transition-colors text-sm"
            >
              contacto@luxeargentina.com
            </a>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-2">Instagram</h3>
            <a
              href="https://www.instagram.com/luxe.arg__/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-900 hover:text-neutral-600 transition-colors text-sm"
            >
              @luxe.arg__
            </a>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-2">Dirección</h3>
            <p className="text-neutral-700 text-sm">Las Palmas 1546</p>
            <p className="text-neutral-500 text-sm">Concordia, Entre Ríos</p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-neutral-400 mb-2">Horarios</h3>
            <p className="text-neutral-700 text-sm">Lunes a Sábados de 9 a 13 y 17 a 21 hs</p>
          </div>
        </div>

        <div className="bg-neutral-50 border border-neutral-100 p-8">
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Para consultas sobre productos, talles, stock o envíos, escribinos por WhatsApp. Te respondemos lo antes posible.
          </p>
          <a
            href="https://wa.me/5493454161528"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Escribinos
          </a>
        </div>
      </div>
    </div>
  );
}
