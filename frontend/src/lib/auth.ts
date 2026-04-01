function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access') || null;
}

export async function refreshAccess(): Promise<string | null> {
  try {
    const res = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.access) {
      localStorage.setItem('access', data.access);
      scheduleAccessAutoRefresh(data.access);
      return data.access as string;
    }
    return null;
  } catch {
    return null;
  }
}

export function scheduleAccessAutoRefresh(accessToken?: string | null): void {
  try {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    const token = accessToken || getAccessToken();
    if (!token) return;
    const decoded = decodeJwt(token);
    if (!decoded || typeof decoded.exp !== 'number') return;
    const nowSec = Math.floor(Date.now() / 1000);
    const secondsUntilExp = Math.max(decoded.exp - nowSec, 0);
    const refreshInMs = Math.max((secondsUntilExp - 60) * 1000, 5000);
    refreshTimer = setTimeout(() => {
      refreshAccess();
    }, refreshInMs);
  } catch {
    // silent
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem('access');
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem('user');
  } catch {
    // ignore
  }
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const opts: RequestInit = { ...init };
  opts.credentials = 'include';
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const access = getAccessToken();
  if (access) {
    headers.set('Authorization', `Bearer ${access}`);
  }
  opts.headers = headers;

  let res = await fetch(input, opts);
  if (res.status !== 401) return res;

  const newAccess = await refreshAccess();
  if (!newAccess) {
    await logoutApi();
    return res;
  }

  const retryHeaders = new Headers(opts.headers);
  retryHeaders.set('Authorization', `Bearer ${newAccess}`);
  const retryOpts: RequestInit = { ...opts, headers: retryHeaders };
  res = await fetch(input, retryOpts);
  if (res.status === 401) {
    await logoutApi();
  }
  return res;
}
