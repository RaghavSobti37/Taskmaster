import { describe, expect, it } from 'vitest';
import { shouldSignOutStaleClerkSession } from './clerkStaleSession';

describe('shouldSignOutStaleClerkSession', () => {
  it('does not sign out when getToken returns null (session still warming)', () => {
    expect(shouldSignOutStaleClerkSession({ token: null })).toBe(false);
    expect(shouldSignOutStaleClerkSession({ token: undefined })).toBe(false);
    expect(shouldSignOutStaleClerkSession({})).toBe(false);
  });

  it('does not sign out when a token exists', () => {
    expect(shouldSignOutStaleClerkSession({ token: 'jwt' })).toBe(false);
  });

  it('signs out only on explicit Clerk auth failures', () => {
    expect(shouldSignOutStaleClerkSession({ token: null, error: { status: 401 } })).toBe(true);
    expect(shouldSignOutStaleClerkSession({ token: null, error: { status: 403 } })).toBe(true);
    expect(shouldSignOutStaleClerkSession({
      token: null,
      error: { response: { status: 401 } },
    })).toBe(true);
  });

  it('does not sign out on retryable / network errors', () => {
    expect(shouldSignOutStaleClerkSession({ token: null, error: { status: 500 } })).toBe(false);
    expect(shouldSignOutStaleClerkSession({ token: null, error: { message: 'network' } })).toBe(false);
  });
});
