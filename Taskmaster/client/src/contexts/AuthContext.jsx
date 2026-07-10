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
import { runClerkSignOut } from '../lib/clerkLogoutRegistry';
import { mergeSessionUser } from '../utils/sessionUserMerge';
import { enrichUserDepartment } from '../utils/enrichUserDepartment';
import { probeAuthSession } from '../utils/authSessionProbe';
import { formatBootError } from '../utils/bootErrorMessage';
import { registerUnauthorizedHandler } from '../lib/authUnauthorized';
import { hasAnalyticsConsent } from '../lib/cookieConsent';
import {
  ensurePostHogForConsent,
  setPostHogUser,
  clearPostHogUser,
  capturePostHogEvent,
} from '../lib/posthog';
import { resolveActiveTenantId } from '../hooks/useActiveTenant';
import { setActiveTenantIdInSession } from '../lib/tenantSession';

const defaultAuthContext = {
  user: null,
  loading: true,
  sessionReady: false,
  bootError: null,
  login: async () => { },
  confirmSessionFromEstablish: async () => { },
  logout: () => { },
  refreshUser: () => { },
  applySessionUser: () => { },
  retryBoot: () => { },
};

const AuthContext = createContext(defaultAuthContext);

/** Marketing/legal routes — defer session probe so LCP is not blocked. */
const PUBLIC_MARKETING_PATHS = new Set([
  '/',
  '/login',
  '/login/choose',
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
  '/login/choose',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

const SESSION_RETRIES = 3;

/** Retry session probe until HttpOnly cookie from clerk-establish is visible. */
async function verifyEstablishedSessionCookie(expectedUserId, isCancelled, maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (isCancelled()) return null;
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
    try {
      const probe = await probeAuthSession();
      if (
        probe.status === 200
        && probe.user?._id
        && String(probe.user._id) === String(expectedUserId)
      ) {
        return probe.user;
      }
    } catch {
      /* retry */
    }
  }
  return null;
}

const applyAxiosBaseURL = () => {
  const axiosBase = getAxiosBaseURL();
  axios.defaults.baseURL = axiosBase || undefined;
};

applyAxiosBaseURL();
axios.defaults.withCredentials = true;

export function userSessionChanged(prev, next) {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  const pick = (u) => ({
    id: String(u._id || ''),
    tenantId: String(u.tenantId || ''),
    activeTenantId: String(u.activeTenantId || ''),
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
    a.tenantId !== b.tenantId ||
    a.activeTenantId !== b.activeTenantId ||
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
  const [bootError, setBootError] = useState(null);
  const userRef = useRef(user);
  const sessionReadyRef = useRef(sessionReady);
  const authEpochRef = useRef(0);
  const loggingOutRef = useRef(false);
  const fetchUserInFlightRef = useRef(null);
  const activeTenantRef = useRef('');
  const activeTenantInitializedRef = useRef(false);

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
    await runClerkSignOut();
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
    setActiveTenantIdInSession(null);
    capturePostHogEvent('user_logged_out');
    clearPostHogUser();
    try {
      sessionStorage.setItem('coreknot_just_logged_out', String(Date.now()));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [queryClient]);

  useEffect(() => {
    return registerUnauthorizedHandler(async () => {
      if (loggingOutRef.current) return;
      await logout();
    });
  }, [logout]);

  const activeTenantId = resolveActiveTenantId(user);

  useEffect(() => {
    const nextTenantId = activeTenantId ? String(activeTenantId) : '';
    if (!activeTenantInitializedRef.current) {
      activeTenantInitializedRef.current = true;
      activeTenantRef.current = nextTenantId;
      setActiveTenantIdInSession(nextTenantId || null);
      return;
    }
    if (activeTenantRef.current === nextTenantId) return;

    activeTenantRef.current = nextTenantId;
    setActiveTenantIdInSession(nextTenantId || null);
    queryClient.clear();
  }, [activeTenantId, queryClient]);

  const fetchUser = useCallback(async (options = {}) => {
    if (loggingOutRef.current) return null;
    const { clearOn401 = true, retries = SESSION_RETRIES, forceFresh = false } = options;
    if (fetchUserInFlightRef.current) {
      if (!forceFresh) {
        return fetchUserInFlightRef.current;
      }
      fetchUserInFlightRef.current = null;
    }

    const run = async () => {
      const epoch = authEpochRef.current;
      let lastError = null;

      for (let attempt = 0; attempt < retries; attempt += 1) {
        if (epoch !== authEpochRef.current) return null;
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          if (epoch !== authEpochRef.current) return null;
        }

        let probe;
        try {
          probe = await probeAuthSession();
          lastError = null;
        } catch (err) {
          lastError = err;
          if (attempt < retries - 1) continue;
          setBootError(formatBootError(err));
          setUser(null);
          setSessionReady(false);
          setLoading(false);
          return null;
        }

        if (epoch !== authEpochRef.current) return null;

        setBootError(null);

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

        const newData = await enrichUserDepartment(probe.user);
        if (userSessionChanged(userRef.current, newData)) {
          setUser(newData);
        }
        if (newData && hasAnalyticsConsent()) {
          ensurePostHogForConsent();
          setPostHogUser(newData);
        }
        if (newData && !userRef.current) {
          recordAttendanceSessionLogin();
        }
        setLoading(false);
        setSessionReady(true);
        return newData;
      }

      if (lastError) {
        setBootError(formatBootError(lastError));
      }
      setUser(null);
      setSessionReady(false);
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
    fetchUserInFlightRef.current = null;
    try {
      sessionStorage.removeItem('coreknot_just_logged_out');
    } catch {
      /* ignore */
    }
    queryClient.clear();

    const sessionUser = await fetchUser({
      clearOn401: true,
      retries: SESSION_RETRIES,
      forceFresh: true,
    });
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
      setPostHogUser(merged);
      return merged;
    });
    enrichUserDepartment(nextUser).then((enriched) => {
      if (!enriched) return;
      setUser((prev) => {
        const merged = mergeSessionUser(prev, enriched);
        if (!userSessionChanged(prev, merged)) return prev;
        setPostHogUser(merged);
        return merged;
      });
    }).catch(() => { });
  }, []);

  const confirmSessionFromEstablish = useCallback(async (sessionUser) => {
    if (!sessionUser?._id) {
      throw new Error('Session could not be established. Please try again.');
    }
    loggingOutRef.current = false;
    authEpochRef.current += 1;
    const epoch = authEpochRef.current;
    fetchUserInFlightRef.current = null;
    try {
      sessionStorage.removeItem('coreknot_just_logged_out');
    } catch {
      /* ignore */
    }
    queryClient.clear();
    setBootError(null);

    const isCancelled = () => epoch !== authEpochRef.current;

    let verifiedUser = await verifyEstablishedSessionCookie(
      sessionUser._id,
      isCancelled,
    );
    if (!verifiedUser) {
      const fallback = await fetchUser({
        clearOn401: true,
        retries: 2,
        forceFresh: true,
      });
      if (!fallback?._id || isCancelled()) {
        throw new Error('Session could not be established. Please try again.');
      }
      verifiedUser = fallback;
    }

    const enriched = await enrichUserDepartment(verifiedUser).catch(() => verifiedUser);
    if (isCancelled()) return;

    setUser((prev) => {
      const merged = mergeSessionUser(prev, enriched || verifiedUser);
      if (hasAnalyticsConsent()) {
        ensurePostHogForConsent();
        setPostHogUser(merged);
      }
      return merged;
    });
    recordAttendanceSessionLogin();
    setLoading(false);
    setSessionReady(true);
    refetchUserScopedQueries(queryClient);
  }, [fetchUser, queryClient]);

  const retryBoot = useCallback(() => {
    loggingOutRef.current = false;
    setBootError(null);
    setLoading(true);
    return fetchUser();
  }, [fetchUser]);

  const value = useMemo(() => ({
    user,
    loading,
    sessionReady,
    bootError,
    login,
    confirmSessionFromEstablish,
    logout,
    refreshUser: fetchUser,
    applySessionUser,
    retryBoot,
  }), [user, loading, sessionReady, bootError, login, confirmSessionFromEstablish, logout, fetchUser, applySessionUser, retryBoot]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext) ?? defaultAuthContext;
