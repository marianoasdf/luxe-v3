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
    <svg className="w-5 h-5 text-neutral-900" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a1.5 1.5 0 011.5 1.5h16.5a1.5 1.5 0 011.5-1.5V5.25a1.5 1.5 0 01-1.5-1.5H3.75a1.5 1.5 0 01-1.5 1.5v13.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5h-1.5M3 7.5h1.5M21 16.5h-1.5M3 16.5h1.5" />
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

    </div>
  );
}
