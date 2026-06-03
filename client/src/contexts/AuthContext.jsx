import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { subscribeToChannel, disconnectRealtime } from '../lib/realtime';
import { pushCustomToast } from '../lib/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskDomainRealtimeSync } from '../hooks/queries/taskRealtime';
import {
  clearAttendanceSessionLogin,
  recordAttendanceSessionLogin,
} from '../utils/attendancePrompt';
import { getAxiosBaseURL } from '../utils/apiBase';
import { markForceLogout, consumeForceLogout } from '../utils/authSession';
import { refetchUserScopedQueries } from '../lib/queryInvalidation';

const defaultAuthContext = {
  user: null,
  loading: true,
  sessionReady: false,
  login: async () => {},
  logout: () => {},
  refreshUser: () => {},
};

const AuthContext = createContext(defaultAuthContext);

const axiosBase = getAxiosBaseURL();
if (axiosBase) {
  axios.defaults.baseURL = axiosBase;
}
axios.defaults.withCredentials = true;

function userSessionChanged(prev, next) {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  const pick = (u) => ({
    id: String(u._id || ''),
    updatedAt: u.updatedAt || '',
    departmentId: String(u.departmentId?._id || u.departmentId || ''),
    pagePermissions: JSON.stringify(u.departmentId?.pagePermissions || u.pagePermissions || null),
    exp: u.exp,
    level: u.level,
  });
  const a = pick(prev);
  const b = pick(next);
  return (
    a.id !== b.id ||
    a.updatedAt !== b.updatedAt ||
    a.departmentId !== b.departmentId ||
    a.pagePermissions !== b.pagePermissions ||
    a.exp !== b.exp ||
    a.level !== b.level
  );
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const userRef = useRef(user);
  const authEpochRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    loggingOutRef.current = true;
    authEpochRef.current += 1;
    markForceLogout();
    try {
      await axios.post('/api/auth/logout');
    } catch {
      // Cookie may already be cleared
    }
    clearAttendanceSessionLogin();
    disconnectRealtime();
    queryClient.clear();
    setSessionReady(false);
    setUser(null);
    setLoading(false);
  }, [queryClient]);

  const fetchUser = useCallback(async (options = {}) => {
    if (loggingOutRef.current) return null;
    const epoch = authEpochRef.current;
    const { clearOn401 = true } = options;
    try {
      const res = await axios.get('/api/auth/me');
      if (epoch !== authEpochRef.current) return null;
      const newData = res.data;
      if (userSessionChanged(userRef.current, newData)) {
        setUser(newData);
      }
      if (newData && !userRef.current) {
        recordAttendanceSessionLogin();
      }
      setLoading(false);
      setSessionReady(true);
      return newData;
    } catch (err) {
      if (epoch !== authEpochRef.current) return null;
      const status = err.response?.status;
      if (clearOn401 && (status === 401 || status === 403)) {
        setUser(null);
        setSessionReady(false);
      }
      setLoading(false);
      return null;
    }
  }, []);

  const syncSessionAfterLogin = useCallback(async () => {
    const epoch = authEpochRef.current;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (epoch !== authEpochRef.current) return;
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        if (epoch !== authEpochRef.current) return;
      }
      const sessionUser = await fetchUser({ clearOn401: false });
      if (sessionUser) return;
    }
  }, [fetchUser]);

  useEffect(() => {
    if (consumeForceLogout()) {
      loggingOutRef.current = true;
      authEpochRef.current += 1;
      (async () => {
        try {
          await axios.post('/api/auth/logout');
        } catch { /* ignore */ }
        queryClient.clear();
        setSessionReady(false);
        setUser(null);
        setLoading(false);
      })();
      return;
    }
    loggingOutRef.current = false;
    fetchUser();
  }, [fetchUser, queryClient]);

  useEffect(() => {
    if (user?._id) {
      const interval = setInterval(fetchUser, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user?._id, fetchUser]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted || !userRef.current?._id || !sessionReady) return;
      refetchUserScopedQueries(queryClient);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [sessionReady, queryClient]);

  useTaskDomainRealtimeSync(sessionReady && !!user?._id);

  useEffect(() => {
    if (!user?._id || !sessionReady) return undefined;

    let cancelled = false;
    let cleanups = [];

    const setupRealtime = () => {
      if (cancelled) return;

      const unsubAwarded = subscribeToChannel(`user-${user._id}`, 'xp_awarded', (payload) => {
      setUser((prev) => ({
        ...prev,
        exp: payload.newTotal,
        level: payload.newLevel ?? prev.level,
      }));

      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });

      const actionLabel = payload.actionLabel || payload.action?.replace(/_/g, ' ') || 'XP';
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
                    +{payload.amount} XP • {actionLabel}
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

    const unsubRecalc = subscribeToChannel(`user-${user._id}`, 'xp_recalculated', (payload) => {
      if (payload.newExp != null) {
        setUser((prev) => ({
          ...prev,
          exp: payload.newExp,
          level: payload.newLevel ?? prev.level,
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.refetchQueries({ queryKey: ['gamification', 'leaderboard'] });
    });

    const unsubGlobalRecalc = subscribeToChannel('gamification', 'gamification_recalculated', () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.refetchQueries({ queryKey: ['gamification', 'leaderboard'] });
    });

      cleanups = [unsubAwarded, unsubRecalc, unsubGlobalRecalc];
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(setupRealtime, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
        cleanups.forEach((unsub) => unsub?.());
      };
    }

    const timer = setTimeout(setupRealtime, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanups.forEach((unsub) => unsub?.());
    };
  }, [user?._id, sessionReady, queryClient]);

  const login = useCallback(async (userData) => {
    loggingOutRef.current = false;
    authEpochRef.current += 1;
    setSessionReady(false);
    queryClient.clear();
    recordAttendanceSessionLogin();
    setUser(userData);
    setLoading(false);
    await syncSessionAfterLogin();
    setSessionReady(true);
    refetchUserScopedQueries(queryClient);
  }, [syncSessionAfterLogin, queryClient]);

  const value = useMemo(() => ({
    user,
    loading,
    sessionReady,
    login,
    logout,
    refreshUser: fetchUser,
  }), [user, loading, sessionReady, login, logout, fetchUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) ?? defaultAuthContext;
