import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../utils/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'mg_auth_token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // null = belum tahu (cek session), false = selesai cek & tidak login
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await apiGet('/api/auth/me');
      setUser(res.user);
      setLoading(false);
      return res.user;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username, password) => {
    try {
      const res = await apiPost('/api/auth/login', { username, password });
      localStorage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      return { success: true, user: res.user };
    } catch (e) {
      return { success: false, message: e.message || 'Login gagal' };
    }
  };

  const logout = async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } catch {
      /* abaikan */
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const value = {
    user,
    isAdmin: !!user && user.role === 'admin',
    isStaff: !!user,
    login,
    logout,
    loading,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
