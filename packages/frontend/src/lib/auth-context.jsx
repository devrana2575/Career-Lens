import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function login({ email, password }) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.tokens.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function register({ email, password, displayName }) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    });
    setToken(data.tokens.accessToken);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}