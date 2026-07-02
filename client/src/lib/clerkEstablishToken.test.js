import { describe, expect, it, vi } from 'vitest';
import { fetchClerkEstablishToken } from './clerkEstablishToken';

describe('fetchClerkEstablishToken', () => {
  it('returns session token without org pin when none configured', async () => {
    const getToken = vi.fn(async () => 'jwt_session');
    const setActive = vi.fn();

    const result = await fetchClerkEstablishToken({
      getToken,
      setActive,
      pinnedOrgId: '',
      activeOrgId: null,
    });

    expect(result).toEqual({ ok: true, token: 'jwt_session' });
    expect(setActive).not.toHaveBeenCalled();
    expect(getToken).toHaveBeenCalledWith();
  });

  it('activates pinned org before requesting org-scoped token', async () => {
    const getToken = vi.fn(async (opts) => (opts?.organizationId ? 'jwt_org' : 'jwt_user'));
    const setActive = vi.fn(async () => ({}));

    const result = await fetchClerkEstablishToken({
      getToken,
      setActive,
      pinnedOrgId: 'org_abc',
      activeOrgId: null,
    });

    expect(setActive).toHaveBeenCalledWith({ organization: 'org_abc' });
    expect(result).toEqual({ ok: true, token: 'jwt_org' });
  });

  it('falls back to user token when org-scoped token is unavailable', async () => {
    const getToken = vi.fn(async (opts) => (opts?.organizationId ? null : 'jwt_user'));
    const setActive = vi.fn();

    const result = await fetchClerkEstablishToken({
      getToken,
      setActive,
      pinnedOrgId: 'org_abc',
      activeOrgId: 'org_abc',
    });

    expect(result).toEqual({ ok: true, token: 'jwt_user' });
    expect(setActive).not.toHaveBeenCalled();
  });

  it('marks missing token as retryable', async () => {
    const getToken = vi.fn(async () => null);

    const result = await fetchClerkEstablishToken({
      getToken,
      setActive: vi.fn(),
      pinnedOrgId: '',
      activeOrgId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('surfaces org activation failure', async () => {
    const setActive = vi.fn(async () => {
      throw new Error('not a member');
    });

    const result = await fetchClerkEstablishToken({
      getToken: vi.fn(),
      setActive,
      pinnedOrgId: 'org_bad',
      activeOrgId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error.message).toMatch(/not a member/i);
  });
});
