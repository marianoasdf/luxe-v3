'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { logoutApi } from '@/lib/auth';
import type { UserSafe } from '@/types';

interface AuthContextValue {
  user: UserSafe | null;
  setUser: (u: UserSafe | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserSafe | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setUser = useCallback((u: UserSafe | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUserState(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, logout }), [user, setUser, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
