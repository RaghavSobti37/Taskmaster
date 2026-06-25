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
import { isStandaloneDisplay } from '../utils/displayMode';
import { markForceLogout, consumeForceLogout } from '../utils/authSession';
import { refetchUserScopedQueries } from '../lib/queryInvalidation';
import { mergeSessionUser } from '../utils/sessionUserMerge';
import { probeAuthSession } from '../utils/authSessionProbe';
import { setSentryUser, clearSentryUser } from '../lib/sentry';
import { setDatadogUser, clearDatadogUser } from '../lib/datadog';
import { setPostHogUser, clearPostHogUser, capturePostHogEvent } from '../lib/posthog';
import { registerUnauthorizedHandler } from '../lib/authUnauthorized';

const defaultAuthContext = {
  user: null,
  loading: true,
  sessionReady: false,
  login: async () => {},
  logout: () => {},
  refreshUser: () => {},
  applySessionUser: () => {},
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

const SESSION_RETRIES = 3;

const applyAxiosBaseURL = () => {
  const axiosBase = getAxiosBaseURL();
  axios.defaults.baseURL = axiosBase || undefined;
};

applyAxiosBaseURL();
axios.defaults.withCredentials = true;

function userSessionChanged(prev, next) {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  const pick = (u) => ({
    id: String(u._id || ''),
    updatedAt: u.updatedAt || '',
    name: u.name || '',
    avatar: u.avatar || '',
    phone: u.phone || '',
    dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString() : '',
    teams: JSON.stringify(u.teams || []),
    departmentId: String(u.departmentId?._id || u.departmentId || ''),
    pagePermissions: JSON.stringify(u.departmentId?.pagePermissions || u.pagePermissions || null),
    exp: u.exp,
    level: u.level,
    mustChangePassword: Boolean(u.mustChangePassword),
  });
  const a = pick(prev);
  const b = pick(next);
  return (
    a.id !== b.id ||
    a.updatedAt !== b.updatedAt ||
    a.departmentId !== b.departmentId ||
    a.pagePermissions !== b.pagePermissions ||
    a.exp !== b.exp ||
    a.level !== b.level ||
    a.mustChangePassword !== b.mustChangePassword
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
  const fetchUserInFlightRef = useRef(null);

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
    capturePostHogEvent('user_logged_out');
    clearSentryUser();
    clearDatadogUser();
    clearPostHogUser();
    setLoading(false);
  }, [queryClient]);

  useEffect(() => {
    return registerUnauthorizedHandler(async () => {
      if (loggingOutRef.current) return;
      await logout();
    });
  }, [logout]);

  const fetchUser = useCallback(async (options = {}) => {
    if (loggingOutRef.current) return null;
    const { clearOn401 = true, retries = SESSION_RETRIES } = options;
    if (fetchUserInFlightRef.current) {
      return fetchUserInFlightRef.current;
    }

    const run = async () => {
      const epoch = authEpochRef.current;

      for (let attempt = 0; attempt < retries; attempt += 1) {
        if (epoch !== authEpochRef.current) return null;
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          if (epoch !== authEpochRef.current) return null;
        }

        let probe;
        try {
          probe = await probeAuthSession();
        } catch {
          if (attempt < retries - 1) continue;
          setLoading(false);
          return null;
        }

        if (epoch !== authEpochRef.current) return null;

        if (probe.status === 401) {
          if (clearOn401) {
            setUser(null);
            setSessionReady(false);
          }
          setLoading(false);
          return null;
        }

        if (probe.status === 403) {
          setLoading(false);
          setSessionReady(true);
          return userRef.current;
        }

        const newData = probe.user;
        if (userSessionChanged(userRef.current, newData)) {
          setUser(newData);
          setSentryUser(newData);
          setDatadogUser(newData);
          setPostHogUser(newData);
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
    };

    const promise = run();
    fetchUserInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      if (fetchUserInFlightRef.current === promise) {
        fetchUserInFlightRef.current = null;
      }
    }
  }, []);

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
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || loggingOutRef.current) return;
      applyAxiosBaseURL();
      if (userRef.current?._id) {
        fetchUser({ clearOn401: true, retries: SESSION_RETRIES }).then((sessionUser) => {
          if (sessionUser && isStandaloneDisplay()) {
            refetchUserScopedQueries(queryClient);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchUser, queryClient]);

  useEffect(() => {
    const onPageShow = (event) => {
      if (loggingOutRef.current) return;
      applyAxiosBaseURL();
      if (!event.persisted || !userRef.current?._id || !sessionReadyRef.current) return;
      refetchUserScopedQueries(queryClient);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [queryClient]);

  useAuthenticatedRealtime({
    userId: user?._id,
    sessionReady,
    setUser,
  });

  const login = useCallback(async () => {
    loggingOutRef.current = false;
    authEpochRef.current += 1;
    queryClient.clear();

    const sessionUser = await fetchUser({ clearOn401: true, retries: SESSION_RETRIES });
    if (!sessionUser) {
      setSessionReady(false);
      throw new Error('Session could not be established. Please try again.');
    }

    setSessionReady(true);
    refetchUserScopedQueries(queryClient);
  }, [fetchUser, queryClient]);

  const applySessionUser = useCallback((nextUser) => {
    if (!nextUser) return;
    setUser((prev) => {
      const merged = mergeSessionUser(prev, nextUser);
      setSentryUser(merged);
      setDatadogUser(merged);
      setPostHogUser(merged);
      return merged;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    sessionReady,
    login,
    logout,
    refreshUser: fetchUser,
    applySessionUser,
  }), [user, loading, sessionReady, login, logout, fetchUser, applySessionUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) ?? defaultAuthContext;
