import { describe, expect, it } from 'vitest';
import {
  computeLoginUiState,
  isClerkAuthSubflowPath,
  isClerkReadyForCoreKnotEstablish,
  isClerkSignInSubflowPath,
  resolveClerkAuthPathname,
  resolveClerkSignInPathname,
} from './clerkSignInFlow';

describe('clerkSignInFlow', () => {
  it('detects in-progress Clerk sign-in sub-routes', () => {
    expect(isClerkSignInSubflowPath('/login/client-trust')).toBe(true);
    expect(isClerkAuthSubflowPath('/login/factor-two')).toBe(true);
    expect(isClerkAuthSubflowPath('/register/verify')).toBe(true);
    expect(isClerkSignInSubflowPath('/login')).toBe(false);
    expect(isClerkSignInSubflowPath('/login/')).toBe(false);
    expect(isClerkAuthSubflowPath('/register')).toBe(false);
  });

  it('prefers browser pathname when router lags on subflow', () => {
    const prev = window.location.pathname;
    window.history.replaceState({}, '', '/login/client-trust');
    expect(resolveClerkSignInPathname('/login')).toBe('/login/client-trust');
    expect(resolveClerkAuthPathname('/login')).toBe('/login/client-trust');
    window.history.replaceState({}, '', prev);
  });

  it('prefers browser pathname for register subflow', () => {
    const prev = window.location.pathname;
    window.history.replaceState({}, '', '/register/verify');
    expect(resolveClerkAuthPathname('/register')).toBe('/register/verify');
    window.history.replaceState({}, '', prev);
  });

  it('blocks establish during client-trust even when signed in', () => {
    expect(isClerkReadyForCoreKnotEstablish({
      pathname: '/login/client-trust',
      isLoaded: true,
      isSignedIn: true,
      sessionId: 'sess_1',
    })).toBe(false);
  });

  it('blocks establish during register verify subflow', () => {
    expect(isClerkReadyForCoreKnotEstablish({
      pathname: '/register/verify',
      isLoaded: true,
      isSignedIn: true,
      sessionId: 'sess_1',
    })).toBe(false);
  });

  it('allows establish on /login after session is active', () => {
    expect(isClerkReadyForCoreKnotEstablish({
      pathname: '/login',
      isLoaded: true,
      isSignedIn: true,
      sessionId: 'sess_1',
    })).toBe(true);
  });

  it('keeps SignIn visible on client-trust even with an existing CoreKnot session', () => {
    expect(computeLoginUiState({
      clerkReady: true,
      clerkLoaded: true,
      clerkSignedIn: false,
      clerkSessionId: null,
      pathname: '/login/client-trust',
      authLoading: false,
      user: { _id: 'u1' },
      sessionReady: true,
      establishError: null,
      bootError: null,
    })).toBe('SHOW_SIGN_IN');
  });

  it('shows establishing only after sign-in completes on /login', () => {
    expect(computeLoginUiState({
      clerkReady: true,
      clerkLoaded: true,
      clerkSignedIn: true,
      clerkSessionId: 'sess_1',
      pathname: '/login',
      authLoading: false,
      user: null,
      sessionReady: false,
      establishError: null,
      bootError: null,
    })).toBe('ESTABLISHING');
  });

  it('shows establishing on /register after sign-up completes', () => {
    expect(computeLoginUiState({
      clerkReady: true,
      clerkLoaded: true,
      clerkSignedIn: true,
      clerkSessionId: 'sess_1',
      pathname: '/register',
      authLoading: false,
      user: null,
      sessionReady: false,
      establishError: null,
      bootError: null,
    })).toBe('ESTABLISHING');
  });

  it('shows SignIn while CoreKnot session probe is still loading', () => {
    expect(computeLoginUiState({
      clerkReady: true,
      clerkLoaded: true,
      clerkSignedIn: false,
      clerkSessionId: null,
      pathname: '/login',
      authLoading: true,
      user: null,
      sessionReady: false,
      establishError: null,
      bootError: null,
    })).toBe('SHOW_SIGN_IN');
  });
});
