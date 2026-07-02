import { describe, expect, it } from 'vitest';
import {
  isClerkReadyForCoreKnotEstablish,
  isClerkSignInSubflowPath,
} from './clerkSignInFlow';

describe('clerkSignInFlow', () => {
  it('detects in-progress Clerk sign-in sub-routes', () => {
    expect(isClerkSignInSubflowPath('/login/client-trust')).toBe(true);
    expect(isClerkSignInSubflowPath('/login/factor-two')).toBe(true);
    expect(isClerkSignInSubflowPath('/login')).toBe(false);
    expect(isClerkSignInSubflowPath('/login/')).toBe(false);
  });

  it('blocks establish during client-trust even when signed in', () => {
    expect(isClerkReadyForCoreKnotEstablish({
      pathname: '/login/client-trust',
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
});
