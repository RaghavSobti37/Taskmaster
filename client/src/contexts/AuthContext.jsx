import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAuthenticatedRealtime,
  disconnectAuthenticatedRealtime,
} from '../hooks/useAuthenticatedRealtime';
import {
  clearAttendanceSessionLogin,
  recordAttendanceSessionLogin,
} from '../utils/attendancePrompt';
import { getAxiosBaseURL } from '../utils/apiBase';
import { isStandaloneDisplay, shouldUseSameOriginApi } from '../utils/displayMode';
import { markForceLogout, consumeForceLogout } from '../utils/authSession';
import { refetchUserScopedQueries } from '../lib/queryInvalidation';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

const defaultAuthContext = {
  user: null,
  loading: true,
  sessionReady: false,
  login: async () => {},
  logout: () => {},
  refreshUser: () => {},
};

const AuthContext = createContext(defaultAuthContext);

/** Marketing/legal routes — defer session probe so LCP is not blocked. */
const PUBLIC_MARKETING_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/relegends',
  '/privacy',
  '/userdata',
  '/unsubscribe',
]);

/** Auth routes need an immediate session probe so stale cookies redirect before login submit. */
const IMMEDIATE_SESSION_PROBE_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

const applyAxiosBaseURL = () => {
  const axiosBase = getAxiosBaseURL();
  axios.defaults.baseURL = axiosBase || undefined;
};

applyAxiosBaseURL();
axios.defaults.withCredentials = true;

const defaultSessionRetries = () => (shouldUseSameOriginApi() ? 6 : 3);

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
  const sessionReadyRef = useRef(sessionReady);
  const authEpochRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    sessionReadyRef.current = sessionReady;
  }, [sessionReady]);

  useEffect(() => {
    applyAxiosBaseURL();
  }, []);

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
    disconnectAuthenticatedRealtime();
    queryClient.clear();
    setSessionReady(false);
    setUser(null);
    setLoading(false);
  }, [queryClient]);

  const fetchUser = useCallback(async (options = {}) => {
    if (loggingOutRef.current) return null;
    const epoch = authEpochRef.current;
    const { clearOn401 = true, retries = defaultSessionRetries() } = options;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      if (epoch !== authEpochRef.current) return null;
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        if (epoch !== authEpochRef.current) return null;
      }

      let res;
      try {
        res = await axios.get('/api/auth/me', {
          ...AXIOS_SKIP_TOAST,
          validateStatus: (status) => status === 200 || status === 401 || status === 403,
        });
      } catch {
        if (attempt < retries - 1) continue;
        setLoading(false);
        return null;
      }

      if (epoch !== authEpochRef.current) return null;

      if (res.status === 401 || res.status === 403) {
        const sessionExpired = String(res.data?.error || '').includes('Session expired');
        // #region agent log
        fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '07dabc' },
          body: JSON.stringify({
            sessionId: '07dabc',
            location: 'AuthContext.jsx:fetchUser',
            message: 'session probe unauthorized',
            data: {
              status: res.status,
              attempt,
              retries,
              clearOn401,
              sessionExpired,
              axiosBaseURL: axios.defaults.baseURL || null,
              requestUrl: res.config?.url || null,
              error: res.data?.error || null,
            },
            hypothesisId: 'E',
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (!sessionExpired && attempt < retries - 1) continue;
        if (clearOn401) {
          setUser(null);
          setSessionReady(false);
        }
        setLoading(false);
        return null;
      }

      const newData = res.data;
      // #region agent log
      fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '07dabc' },
        body: JSON.stringify({
          sessionId: '07dabc',
          location: 'AuthContext.jsx:fetchUser',
          message: 'session probe ok',
          data: {
            attempt,
            userId: newData?._id || null,
            axiosBaseURL: axios.defaults.baseURL || null,
            requestUrl: res.config?.url || null,
          },
          hypothesisId: 'E',
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (userSessionChanged(userRef.current, newData)) {
        setUser(newData);
      }
      if (newData && !userRef.current) {
        recordAttendanceSessionLogin();
      }
      setLoading(false);
      setSessionReady(true);
      return newData;
    }

    setLoading(false);
    return null;
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
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const deferSessionProbe = PUBLIC_MARKETING_PATHS.has(path)
      && !IMMEDIATE_SESSION_PROBE_PATHS.has(path);
    const runFetch = () => fetchUser();

    if (deferSessionProbe) {
      setLoading(false);
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const id = window.requestIdleCallback(runFetch, { timeout: 2500 });
        return () => window.cancelIdleCallback(id);
      }
      const timer = window.setTimeout(runFetch, 0);
      return () => window.clearTimeout(timer);
    }

    fetchUser();
  }, [fetchUser, queryClient]);

  useEffect(() => {
    if (user?._id) {
      const interval = setInterval(() => {
        fetchUser({ clearOn401: true, retries: 2 });
      }, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user?._id, fetchUser]);

  const resumePwaSession = useCallback(async () => {
    if (loggingOutRef.current) return;
    const sessionUser = await fetchUser({ clearOn401: true, retries: defaultSessionRetries() });
    if (sessionUser) {
      refetchUserScopedQueries(queryClient);
    }
  }, [fetchUser, queryClient]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || loggingOutRef.current) return;
      if (isStandaloneDisplay()) {
        resumePwaSession();
        return;
      }
      if (userRef.current?._id) {
        fetchUser({ clearOn401: true, retries: defaultSessionRetries() });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchUser, resumePwaSession]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (loggingOutRef.current) return;
      if (isStandaloneDisplay()) {
        resumePwaSession();
        return;
      }
      if (!event.persisted || !userRef.current?._id || !sessionReadyRef.current) return;
      refetchUserScopedQueries(queryClient);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [resumePwaSession, queryClient]);

  useAuthenticatedRealtime({
    userId: user?._id,
    sessionReady,
    setUser,
  });

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
