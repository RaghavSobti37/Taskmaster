import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../lib/clerkLogoutRegistry', () => ({
  runClerkSignOut: vi.fn(() => Promise.resolve()),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

import axios from 'axios';
import {
  SESSION_RESET_DONE_KEY,
  expireReadableAuthCookies,
  hasCompletedSessionReset,
  markSessionResetDone,
  resetAuthSession,
  shouldOfferSessionReset,
} from './authSessionReset';

describe('authSessionReset', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('offers reset until completed once', () => {
    expect(shouldOfferSessionReset()).toBe(true);
    markSessionResetDone();
    expect(shouldOfferSessionReset()).toBe(false);
    expect(hasCompletedSessionReset()).toBe(true);
  });

  it('still offers reset when boot failed even if already cleared before', () => {
    markSessionResetDone();
    expect(shouldOfferSessionReset({ bootError: true })).toBe(true);
  });

  it('resetAuthSession calls logout and marks done', async () => {
    await resetAuthSession();
    expect(axios.post).toHaveBeenCalledWith(
      '/api/auth/logout',
      {},
      expect.objectContaining({ withCredentials: true }),
    );
    expect(localStorage.getItem(SESSION_RESET_DONE_KEY)).toBe('1');
  });

  it('expireReadableAuthCookies writes max-age=0 for auth cookie names', () => {
    document.cookie = 'coreknot_token_v3=stale; path=/';
    expireReadableAuthCookies();
    expect(document.cookie).not.toContain('coreknot_token_v3=stale');
  });
});
