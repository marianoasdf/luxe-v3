'use client';

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id: number) => void;
    };
  }
}

export default function RegisterPage() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [exito, setExito] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const widgetIdRef = useRef<number | null>(null);
  const router = useRouter();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const simpleEmailRegex = /^\S+@\S+\.\S+$/;
    if (!simpleEmailRegex.test(form.email.trim())) {
      setError('Revisá el formato del correo.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, captchaToken: captchaToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.require_captcha) {
          setCaptchaRequired(true);
          setCaptchaToken('');
        }
        const errMsg = data?.error || data?.errors?.[0]?.msg || 'Error al registrar';
        throw new Error(errMsg);
      }
      setExito(true);
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Error al registrar';
      const lower = msg.toLowerCase();
      if (lower.includes('dominio no permitido')) msg = 'No aceptamos correos temporales. Usá un correo real.';
      else if (lower.includes('email inválido')) msg = 'Revisá el formato del correo.';
      else if (lower.includes('demasiados registros')) msg = 'Demasiados intentos. Probá más tarde.';
      setError(msg);
    } finally {
      setCaptchaToken('');
      try {
        if (captchaRequired && window.turnstile && widgetIdRef.current != null) {
          window.turnstile.reset(widgetIdRef.current);
        }
      } catch { /* ignore */ }
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!captchaRequired) return;
    let attempts = 0;
    const tryRender = () => {
      const el = document.getElementById('register-turnstile');
      if (!el) return;
      if (el.dataset.rendered === 'true') return;
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        const id = window.turnstile.render(el, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          callback: (token: string) => setCaptchaToken(token),
          'error-callback': () => setCaptchaToken(''),
          'expired-callback': () => setCaptchaToken(''),
        });
        widgetIdRef.current = id;
        el.dataset.rendered = 'true';
      } else if (attempts < 20) {
        attempts += 1;
        setTimeout(tryRender, 250);
      }
    };
    tryRender();
  }, [captchaRequired]);

  const handleResend = async () => {
    if (!form.email) return;
    setReenviando(true);
    setInfo('');
    try {
      await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email }),
      });
      setInfo('Si el mail existe y no está verificado, te mandamos el enlace.');
    } catch {
      setInfo('Listo, revisá tu correo.');
    } finally {
      setReenviando(false);
    }
  };

  const emailRegex = /^\S+@\S+\.\S+$/;
  const email = form.email.trim();
  const emailClass = email
    ? emailRegex.test(email) ? 'border-green-400' : 'border-red-400'
    : '';

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-6">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-xl shadow-sm space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            name="nombre"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Tu nombre"
            value={form.nombre}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="text"
            name="email"
            className={`w-full border rounded-lg px-3 py-2 ${emailClass}`}
            placeholder="Tu email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            name="password"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Contraseña"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        {captchaRequired && (
          <div>
            <div id="register-turnstile" />
            <p className="text-sm text-gray-500 mt-1">Completá el captcha para seguir.</p>
          </div>
        )}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Registrando…' : 'Registrarme'}
        </button>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        {exito && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
            ¡Registro exitoso! Revisa tu email para activar la cuenta.
            <button
              type="button"
              className="block w-full mt-2 border border-gray-300 rounded-lg py-2 hover:bg-gray-100 text-sm"
              onClick={handleResend}
              disabled={reenviando || !form.email}
            >
              {reenviando ? 'Enviando…' : 'Reenviar verificación'}
            </button>
            {info && <div className="mt-2 bg-blue-50 text-blue-700 p-2 rounded text-sm">{info}</div>}
          </div>
        )}
      </form>
    </div>
  );
}
