'use client';

import { useState } from 'react';
import { formatoPrecio } from '@/lib/utils';

interface TransferConfig {
  alias: string;
  cvu: string;
  holderName: string;
  holderCuit: string;
}

interface TransferPaymentProps {
  orderId: number;
  amount: number;
  discountPercent: number;
  currency: string;
  expiresAt: string;
}

// Configuracion de la cuenta de transferencia (se puede mover a variables de entorno)
const TRANSFER_CONFIG: TransferConfig = {
  alias: process.env.NEXT_PUBLIC_TRANSFER_ALIAS || 'tu-alias.mp',
  cvu: process.env.NEXT_PUBLIC_TRANSFER_CBU || '0000000000000000000000',
  holderName: process.env.NEXT_PUBLIC_TRANSFER_HOLDER_NAME || 'Nombre del Titular',
  holderCuit: process.env.NEXT_PUBLIC_TRANSFER_HOLDER_CUIT || 'XX-XXXXXXXX-X',
};

export default function TransferPayment({ orderId, amount, discountPercent, currency, expiresAt }: TransferPaymentProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const expiryDate = new Date(expiresAt).toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Error copiando al portapapeles:', err);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-amber-900 mb-2">
          💳 Pago por Transferencia Bancaria
        </h3>
        <p className="text-amber-700 text-sm">
          Tu orden esta pendiente. Realiza la transferencia para confirmar tu compra.
        </p>
      </div>

      {/* Monto */}
      <div className="bg-white rounded-lg p-4 border border-amber-200">
        <p className="text-sm text-neutral-600 mb-1">Monto a transferir{discountPercent > 0 ? ` (con ${discountPercent}% de descuento)` : ''}:</p>
        <p className="text-3xl font-bold text-green-600">{formatoPrecio(amount)}</p>
      </div>

      {/* Datos de transferencia */}
      <div className="bg-white rounded-lg p-4 border border-amber-200 space-y-3">
        <h4 className="font-medium text-neutral-900 mb-3">Datos de la cuenta:</h4>
        
        <CopyableField 
          label="Alias"
          value={TRANSFER_CONFIG.alias}
          copied={copiedField === 'alias'}
          onCopy={() => copyToClipboard(TRANSFER_CONFIG.alias, 'alias')}
        />
        
        <CopyableField 
          label="CVU"
          value={TRANSFER_CONFIG.cvu}
          copied={copiedField === 'cvu'}
          onCopy={() => copyToClipboard(TRANSFER_CONFIG.cvu, 'cvu')}
        />
        
        <div className="flex justify-between items-center py-2 border-b border-neutral-100">
          <span className="text-sm text-neutral-600">Titular</span>
          <span className="font-medium">{TRANSFER_CONFIG.holderName}</span>
        </div>
        
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-neutral-600">CUIT/CUIL</span>
          <span className="font-medium">{TRANSFER_CONFIG.holderCuit}</span>
        </div>
      </div>

      {/* Plazo */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">
          <strong>⏰ Plazo de pago:</strong> {expiryDate}
        </p>
        <p className="text-red-600 text-xs mt-1">
          Si no recibimos tu comprobante antes de esta fecha, la orden sera cancelada automaticamente.
        </p>
      </div>

      {/* Instrucciones - Solo WhatsApp */}
      <div className="space-y-3">
        <h4 className="font-medium text-neutral-900">¿Como confirmar tu pago?</h4>
        <div className="bg-white rounded-lg p-4 border border-neutral-200 space-y-3">
          <p className="text-sm text-neutral-600">
            Una vez realizada la transferencia, envianos el comprobante por WhatsApp:
          </p>
          <a 
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '549XXXXXXXXXX'}?text=Hola! Realice el pago de la orden %23${orderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors text-sm w-full"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Enviar comprobante por WhatsApp
          </a>
        </div>
      </div>

      {/* Numero de orden */}
      <div className="text-center text-sm text-neutral-500 pt-4 border-t border-neutral-200">
        Numero de orden: <strong>#{orderId}</strong>
      </div>
    </div>
  );
}

// Componente auxiliar para campos copiables
function CopyableField({ 
  label, 
  value, 
  copied, 
  onCopy 
}: { 
  label: string; 
  value: string; 
  copied: boolean; 
  onCopy: () => void;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium">{value}</span>
        <button
          onClick={onCopy}
          className="text-neutral-400 hover:text-neutral-600 p-1"
          title="Copiar"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
