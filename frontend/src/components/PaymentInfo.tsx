import { formatoPrecio } from '@/lib/utils';

interface PaymentInfoProps {
  price: number;
}

export default function PaymentInfo({ price }: PaymentInfoProps) {
  // Cálculos Luxe
  const cuotas = 3;
  const valorCuota = price / cuotas;

  // Iconos minimalistas en Negro (estilo Luam)
  const IconoTarjeta = () => (
    <svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );

  const IconoBillete = () => (
<svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" strokeLinecap="round" strokeWidth={2} />
  </svg>
);

  // Envío gratis superando los 150.000$
  const IconoEnvioGratis = () => (
<svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7H4a1 1 0 00-1 1v9h3m0 0a2 2 0 104 0m-4 0h6m4 0a2 2 0 104 0m-4 0h1m-1-10l4.5 4V17h-1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7v5h6" />
  </svg>
);

  return (
    <div className="space-y-4 py-5 border-y border-brand-warm/30 my-6 font-sans">
      
      {/* 3 Cuotas sin interés */}
      <div className="flex items-center gap-3">
        <IconoTarjeta />
        <p className="text-[14px] text-neutral-800 leading-none">
          <span className="font-semibold text-neutral-900">{cuotas} cuotas sin interés</span> de <span className="font-semibold">{formatoPrecio(valorCuota)}</span>
        </p>
      </div>

      {/* Transferencia con Billete Real y Texto Simplificado */}
      <div className="flex items-center gap-3">
        <IconoBillete />
        <p className="text-[14px] text-neutral-800 leading-none">
          <span className="font-semibold text-neutral-900">20% de descuento</span> pagando con Transferencia o depósito
        </p>
      </div>

      <div className="flex items-center gap-3">
        <IconoEnvioGratis />
        <p className="text-[14px] text-neutral-800 leading-none">
          <span className="font-semibold text-neutral-900">Envío gratis</span> en compras superiores a <span className="font-semibold">$150.000</span>
        </p>
      </div>

    </div>
  );
}
