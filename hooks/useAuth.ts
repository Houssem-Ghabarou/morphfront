'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, AuthUser } from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuth(): AuthState & { logout: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    api.getMe()
      .then(({ user }) => setState({ user, loading: false }))
      .catch(() => setState({ user: null, loading: false }));
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setState({ user: null, loading: false });
    window.location.href = '/signin';
  }, []);

  return { ...state, logout };
}
