import { Resend } from 'resend';

function shouldSendReal(): boolean {
  return (
    String(process.env.EMAIL_SEND_REAL).toLowerCase() === 'true' &&
    !!process.env.RESEND_API_KEY
  );
}

function getBaseUrl(): string {
  const url = process.env.VERIFICATION_BASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('VERIFICATION_BASE_URL es obligatorio en produccion.');
  }
  return 'http://localhost:3000';
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

interface SendVerificationParams {
  to: string;
  token: string;
}

export async function sendVerificationEmail({
  to,
  token,
}: SendVerificationParams): Promise<unknown> {
  const link = `${getBaseUrl()}/verificar?token=${encodeURIComponent(token)}`;

  if (!shouldSendReal()) {
    console.log(`[email DEV] Verificacion para ${to}: ${link}`);
    return { dev: true, link };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? 'No Reply <no-reply@example.com>';
  const subject = 'Verifica tu email';
  const html = `
    <p>Activa tu cuenta en Luxe:</p>
    <p><a href="${link}">Verificar email</a></p>
    <p>Si no solicitaste esto, podes ignorar este mensaje.</p>
  `;

  const result = await resend.emails.send({ from, to, subject, html });

  if (result && 'error' in result && result.error) {
    console.error('[email] Resend error:', result.error);
  } else {
    const data = result as { data?: { id?: string } };
    const msgId = data?.data?.id ?? 'unknown';
    console.log(`[email] Enviado OK id=${msgId}`);
  }

  return result;
}

// =============================
// Email de confirmacion de orden
// =============================
export interface TransferInstructionsParams {
  to: string;
  orderId: number;
  buyerName: string;
  amount: number;
  currency: string;
  items: any[];
  shipping_cost?: number;
  discount?: number;
  originalTotal?: number;
  expiresAt?: Date;
}

export async function sendOrderConfirmationEmail({
  to,
  orderId,
  buyerName,
  amount,
  currency,
  items = [],
  shipping_cost = 0,
  discount = 0,
  originalTotal = 0,
}: TransferInstructionsParams): Promise<unknown> {
  const subject = 'Gracias por comprar en Luxe';
  const orderUrl = `${getBaseUrl()}/transfer-confirmation?orderId=${orderId}`;

  const itemsDetail = Array.isArray(items)
    ? items.map((item) => {
        const nombre = item.title || item.name || item.nombre || 'Producto';
        let variante = '';
        if (item.color && item.talle) variante = `${item.color}, ${item.talle}`;
        else if (item.color) variante = item.color;
        else if (item.talle) variante = item.talle;
        const cantidad = item.quantity || item.cantidad || 1;
        const precio = item.unit_price || item.price || item.precio || 0;
        const varianteStr = variante ? `(${variante})` : '';
        return `${cantidad} x ${nombre}${varianteStr} por ${formatCurrency(precio, currency)} cada uno.`;
      }).join('<br>')
    : '';

  const html =
    'Gracias por comprar en Luxe<br>' +
    '<br>' +
    `Tu pedido: #${orderId}<br>` +
    '<br>' +
    itemsDetail +
    '<br>' +
    '<br>' +
    `Costo de envío: ${formatCurrency(shipping_cost, currency)}<br>` +
    `Descuento por Transferencia o depósito bancario: ${formatCurrency(discount, currency)}<br>` +
    '<br>' +
    `Total: ${formatCurrency(amount, currency)}<br>` +
    '<br>' +
    'Estamos esperando la confirmación del pago, que puede demorar hasta 72hs hábiles (esto puede variar dependiendo del medio de pago elegido).<br>' +
    'No te preocupes, te vamos a enviar un mensaje cuando esto suceda.<br>' +
    '<br>' +
    'Seguí el estado de tu pedido desde este link:<br>' +
    `<a href="${orderUrl}">${orderUrl}</a><br>` +
    '<br>' +
    'Saludos,<br>Luxe<br>' +
    '<br>' +
    '* * *<br>' +
    'Si no hiciste esta compra o simplemente estabas probando nuestro sitio, por favor desconsiderá este e-mail.';

  if (!shouldSendReal()) {
    console.log(`[email DEV] Confirmacion de compra para ${to}:`);
    console.log(`  Orden: ${orderId}`);
    console.log(`  Link: ${orderUrl}`);
    return { dev: true, to, subject, orderUrl };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? 'Luxe <no-reply@luxe.com>';
  
  const result = await resend.emails.send({ from, to, subject, html });

  if (result && 'error' in result && result.error) {
    console.error('[email] Resend error:', result.error);
    throw new Error('Error enviando email');
  } else {
    const data = result as { data?: { id?: string } };
    const msgId = data?.data?.id ?? 'unknown';
    console.log(`[email] Order confirmation sent id=${msgId} to=${to}`);
  }

  return result;
}

// =============================
// Email de actualizacion de estado
// =============================
export interface OrderStatusUpdateParams {
  to: string;
  orderId: number;
  buyerName: string;
  status: string;
  total: number;
  currency: string;
}

export async function sendOrderStatusUpdateEmail({
  to,
  orderId,
  buyerName,
  status,
  total,
  currency,
}: OrderStatusUpdateParams): Promise<unknown> {
  const statusConfig: Record<string, { title: string; color: string; message: string }> = {
    paid: {
      title: '¡Pago confirmado!',
      color: '#16a34a',
      message: 'Tu pago ha sido confirmado y procesaremos tu pedido a la brevedad.',
    },
    cancelled: {
      title: 'Orden cancelada',
      color: '#dc2626',
      message: 'Tu orden ha sido cancelada. Si tenes dudas, contactanos.',
    },
    failed: {
      title: 'Pago fallido',
      color: '#dc2626',
      message: 'Hubo un problema con tu pago. Por favor, intenta nuevamente o contactanos.',
    },
    pending: {
      title: 'Orden pendiente',
      color: '#ca8a04',
      message: 'Tu orden esta pendiente de pago.',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const formattedAmount = formatCurrency(total, currency);
  const orderUrl = `${getBaseUrl()}/mi-cuenta`;

  const subject = `${config.title} - Orden #${orderId} - Luxe`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${config.color};">${config.title}</h2>
      
      <p>Hola ${buyerName},</p>
      
      <p>${config.message}</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Numero de orden:</strong> #${orderId}</p>
        <p style="margin: 5px 0;"><strong>Estado:</strong> <span style="color: ${config.color}; font-weight: bold;">${status.toUpperCase()}</span></p>
        <p style="margin: 5px 0;"><strong>Total:</strong> ${formattedAmount}</p>
      </div>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="${orderUrl}" style="background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Ver mis ordenes
        </a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        Este es un email automatico. No respondas a esta direccion.
      </p>
    </div>
  `;

  if (!shouldSendReal()) {
    console.log(`[email DEV] Status update para ${to}:`);
    console.log(`  Orden: ${orderId}`);
    console.log(`  Nuevo estado: ${status}`);
    return { dev: true, to, subject };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? 'Luxe <no-reply@luxe.com>';
  
  const result = await resend.emails.send({ from, to, subject, html });

  if (result && 'error' in result && result.error) {
    console.error('[email] Resend error:', result.error);
    throw new Error('Error enviando email');
  } else {
    const data = result as { data?: { id?: string } };
    const msgId = data?.data?.id ?? 'unknown';
    console.log(`[email] Status update sent id=${msgId} to=${to}`);
  }

  return result;
}
