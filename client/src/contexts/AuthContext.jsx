import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { subscribeToChannel, disconnectRealtime } from '../lib/realtime';
import { pushCustomToast } from '../lib/notifications';
import { useQueryClient } from '@tanstack/react-query';

const defaultAuthContext = {
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
};

const AuthContext = createContext(defaultAuthContext);

if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const logout = useCallback(async () => {
    disconnectRealtime();
    try {
      await axios.post('/api/auth/logout');
    } catch {
      // Cookie may already be cleared
    }
    setUser(null);
  }, []);

  const fetchUser = useCallback(async (options = {}) => {
    const { clearOn401 = true } = options;
    try {
      const res = await axios.get('/api/auth/me');
      const newData = res.data;
      if (JSON.stringify(userRef.current) !== JSON.stringify(newData)) {
        setUser(newData);
      }
      setLoading(false);
      return newData;
    } catch (err) {
      if (err.response?.status === 401 && clearOn401) {
        setUser(null);
      }
      setLoading(false);
      return null;
    }
  }, []);

  const syncSessionAfterLogin = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
      const sessionUser = await fetchUser({ clearOn401: false });
      if (sessionUser) return;
    }
  }, [fetchUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user?._id) {
      const interval = setInterval(fetchUser, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user?._id, fetchUser]);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (user?._id) {
      const unsubscribe = subscribeToChannel(`user-${user._id}`, 'xp_awarded', (payload) => {
        setUser((prev) => ({
          ...prev,
          exp: payload.newTotal,
          level: payload.leveledUp ? (prev.level || 1) + 1 : prev.level,
        }));

        queryClient.invalidateQueries({ queryKey: ['missions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });

        pushCustomToast(
          () => (
            <div className="max-w-sm w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] shadow-2xl rounded-2xl pointer-events-auto flex overflow-hidden">
              <div className="p-4 flex-1">
                <div className="flex items-center">
                  <div className="shrink-0 bg-blue-500/10 p-2 rounded-xl">
                    <span className="text-xl">✨</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                      XP Gained!
                    </p>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-0.5">
                      +{payload.amount} XP • {payload.action.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-2 w-full bg-[var(--color-bg-border)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ),
          { id: `xp-${payload.action}`, duration: 4000 }
        );
      });
      return () => unsubscribe();
    }
    return undefined;
  }, [user?._id, queryClient]);

  const login = useCallback((userData) => {
    setUser(userData);
    setLoading(false);
    syncSessionAfterLogin();
  }, [syncSessionAfterLogin]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refreshUser: fetchUser,
  }), [user, loading, login, logout, fetchUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) ?? defaultAuthContext;
