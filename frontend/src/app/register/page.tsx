'use client';

import React, { useState, useEffect, useRef, type ChangeEvent } from 'react';
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="max-w-md mx-auto px-4 py-16 md:py-20">
      <h1 className="font-display text-2xl md:text-3xl text-neutral-900 text-center mb-8">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Nombre</label>
          <input
            type="text"
            name="nombre"
            className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
            placeholder="Tu nombre"
            value={form.nombre}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Email</label>
          <input
            type="text"
            name="email"
            className={`w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors ${emailClass}`}
            placeholder="Tu email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">Contraseña</label>
          <input
            type="password"
            name="password"
            className="w-full border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
            placeholder="Contraseña"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        {captchaRequired && (
          <div>
            <div id="register-turnstile" />
            <p className="text-sm text-neutral-500 mt-1">Completá el captcha para seguir.</p>
          </div>
        )}
        <button
          type="submit"
          className="w-full bg-neutral-900 text-white py-3 text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Registrando…' : 'Registrarme'}
        </button>
        {error && <div className="bg-red-50 text-red-700 p-3 text-sm border border-red-100">{error}</div>}
        {exito && (
          <div className="bg-green-50 text-green-700 p-3 text-sm border border-green-100">
            ¡Registro exitoso! Revisa tu email para activar la cuenta.
            <button
              type="button"
              className="block w-full mt-2 border border-neutral-200 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              onClick={handleResend}
              disabled={reenviando || !form.email}
            >
              {reenviando ? 'Enviando…' : 'Reenviar verificación'}
            </button>
            {info && <div className="mt-2 bg-neutral-50 text-neutral-700 p-2 text-sm border border-neutral-100">{info}</div>}
          </div>
        )}
      </form>
    </div>
  );
}
