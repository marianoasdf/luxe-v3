import { getAccessToken, refreshAccess, scheduleAccessAutoRefresh } from './auth';

export async function logoutCleanup(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch { /* ignore */ }
  try { localStorage.removeItem('access'); } catch { /* ignore */ }
  try { localStorage.removeItem('user'); } catch { /* ignore */ }
}

/**
 * Centralized fetch wrapper that:
 * - Attaches Authorization header from localStorage
 * - Retries once on 401 by refreshing access token
 * - Auto-logs out if refresh also fails
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const opts: RequestInit = { ...init };
  opts.credentials = 'include';
  opts.headers = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  const access = getAccessToken();
  if (access) {
    (opts.headers as Record<string, string>).Authorization = `Bearer ${access}`;
  }

  let res = await fetch(input, opts);
  if (res.status !== 401) return res;

  // Try refresh once
  const newAccess = await refreshAccess();
  if (!newAccess) {
    await logoutCleanup();
    return res;
  }

  scheduleAccessAutoRefresh(newAccess);

  const retryOpts: RequestInit = {
    ...opts,
    headers: { ...(opts.headers as Record<string, string>), Authorization: `Bearer ${newAccess}` },
  };
  res = await fetch(input, retryOpts);
  if (res.status === 401) {
    await logoutCleanup();
  }
  return res;
}
