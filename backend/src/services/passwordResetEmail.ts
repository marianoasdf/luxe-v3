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

export async function sendPasswordResetEmail({ to, token }: { to: string; token: string }): Promise<unknown> {
  const link = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  if (!shouldSendReal()) {
    console.log(`[email DEV] Reset password para ${to}: ${link}`);
    return { dev: true, link };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? 'No Reply <no-reply@example.com>';
  const subject = 'Restablecé tu contraseña';
  const html = `
    <p>Solicitaste restablecer tu contraseña en Luxe.</p>
    <p><a href="${link}">Elegir nueva contraseña</a></p>
    <p>Si no solicitaste esto, podés ignorar este mensaje.</p>
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
