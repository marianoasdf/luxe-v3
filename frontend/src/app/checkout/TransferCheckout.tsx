
import { formatoPrecio } from '@/lib/utils';

interface TransferCheckoutProps {
  subtotal: number;
  shippingCost: number;
  originalTotal: number;
  discount: number;
  discountPercent: number;
  totalConDescuento: number;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  error?: string;
}

export default function TransferCheckout({
  subtotal,
  shippingCost,
  originalTotal,
  discount,
  discountPercent,
  totalConDescuento,
  onCancel,
  onConfirm,
  loading,
  error
}: TransferCheckoutProps) {
  // 100% presentacional, sin lógica de negocio
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-800 mb-2">
          Pago por transferencia bancaria{discount > 0 ? ` (${discountPercent}% de descuento)` : ''}
        </h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600">Subtotal:</span>
            <span>{formatoPrecio(subtotal)}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-600">Envio:</span>
              <span>{formatoPrecio(shippingCost)}</span>
            </div>
          )}
          {discount > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-neutral-600">Total original:</span>
                <span className="line-through text-neutral-400">{formatoPrecio(originalTotal)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Descuento ({discountPercent}%):</span>
                <span>-{formatoPrecio(discount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-green-200 pt-2 mt-2">
            <span className="font-medium">Total a pagar:</span>
            <span className="font-bold text-xl text-green-700">{formatoPrecio(totalConDescuento)}</span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="mb-2">
          <strong>Importante:</strong> Al confirmar, tu orden quedara pendiente de pago.
        </p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Tenes 72 horas para realizar la transferencia</li>
          <li>Te mostraremos los datos de la cuenta en la siguiente pantalla</li>
          <li>Debes enviar el comprobante por WhatsApp</li>
          <li>Confirmaremos tu pago manualmente</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 border border-neutral-300 text-neutral-700 py-3 text-sm uppercase tracking-wider hover:bg-neutral-50 transition-colors"
          disabled={loading}
        >
          Volver
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-3 text-sm uppercase tracking-wider hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Procesando...' : 'Confirmar orden'}
        </button>
      </div>
    </div>
  );
}