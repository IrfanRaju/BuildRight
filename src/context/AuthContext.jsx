import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const TOKEN_KEY = 'buildright-access-token';
const USER_KEY = 'buildright-user';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  const applySession = (token, nextUser) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
    setUser(nextUser);
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    api('/api/auth/me')
      .then((result) => { if (!cancelled) applySession(token, result.user); })
      .catch(() => { if (!cancelled) applySession('', null); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    async register(form) {
      const result = await api('/api/auth/register', { method: 'POST', body: form });
      applySession(result.token, result.user);
      return result.user;
    },
    async login(form) {
      const result = await api('/api/auth/login', { method: 'POST', body: form });
      applySession(result.token, result.user);
      return result.user;
    },
    logout() {
      applySession('', null);
    },
    async updateProfile(name) {
      const result = await api('/api/auth/profile', { method: 'PUT', body: { name } });
      applySession(localStorage.getItem(TOKEN_KEY), result.user);
      return result.user;
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
