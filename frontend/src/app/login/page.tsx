'use client';

import { Suspense, useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleAccessAutoRefresh } from '@/lib/auth';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id: number) => void;
    };
  }
}

export default function LoginPage() {
  return <Suspense fallback={<div className="text-center py-12">Cargando…</div>}><LoginContent /></Suspense>;
}

function LoginContent() {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const widgetIdRef = useRef<number | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (!captchaRequired) return;
    let attempts = 0;
    const tryRender = () => {
      const el = document.getElementById('login-turnstile');
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
      const res = await fetch('/api/login', {
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
        throw new Error(data?.error || data?.errors?.[0]?.msg || 'Error de login');
      }
      if (data?.access) {
        localStorage.setItem('access', data.access);
        scheduleAccessAutoRefresh(data.access);
      }
      if (data?.user) {
        setUser(data.user);
      }
      const redirectTo = searchParams.get('from') || '/';
      router.replace(redirectTo);
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Error de login';
      const lower = msg.toLowerCase();
      if (lower.includes('dominio no permitido')) msg = 'No aceptamos correos temporales. Usá un correo real.';
      else if (lower.includes('email inválido')) msg = 'Revisá el formato del correo.';
      else if (lower.includes('demasiados intentos')) msg = 'Demasiados intentos. Esperá unos minutos.';
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

  const handleResend = async () => {
    setSending(true);
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
      setSending(false);
    }
  };

  const emailRegex = /^\S+@\S+\.\S+$/;
  const email = form.email.trim();
  const emailClass = email
    ? emailRegex.test(email) ? 'border-green-400' : 'border-red-400'
    : '';

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-6">Iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-xl shadow-sm space-y-4" noValidate>
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
        {captchaRequired && (
          <div>
            <div id="login-turnstile" />
            <p className="text-sm text-gray-500 mt-1">Completá el captcha para seguir.</p>
          </div>
        )}
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
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
        )}
        {error?.toLowerCase().includes('verificar tu email') && (
          <button
            type="button"
            className="w-full border border-gray-300 rounded-lg py-2 hover:bg-gray-100 text-sm"
            onClick={handleResend}
            disabled={sending || !form.email}
          >
            {sending ? 'Enviando…' : 'Reenviar verificación'}
          </button>
        )}
        {info && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{info}</div>}
      </form>
    </div>
  );
}
