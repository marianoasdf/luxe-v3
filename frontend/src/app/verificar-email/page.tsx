'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleAccessAutoRefresh } from '@/lib/auth';

export default function VerificarEmailPage() {
  return <Suspense fallback={<div className="text-center py-12">Verificando…</div>}><VerificarContent /></Suspense>;
}

function VerificarContent() {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
  const [message, setMessage] = useState('Verificando tu cuenta...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Falta el token de verificación.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/verify-email?token=${encodeURIComponent(token)}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudo verificar el email');
        if (data?.access) {
          localStorage.setItem('access', data.access);
          scheduleAccessAutoRefresh(data.access);
        }
        if (data?.user) {
          setUser(data.user);
        }
        setStatus('success');
        setMessage('¡Email verificado! Ya iniciamos tu sesión. Redirigiendo...');
        setTimeout(() => router.push('/'), 1200);
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bgClass =
    status === 'success' ? 'bg-green-50 text-green-700' :
    status === 'error' ? 'bg-red-50 text-red-700' :
    'bg-blue-50 text-blue-700';

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className={`${bgClass} p-6 rounded-xl`}>{message}</div>
    </div>
  );
}
