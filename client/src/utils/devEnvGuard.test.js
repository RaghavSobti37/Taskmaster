import { describe, it, expect, vi, afterEach } from 'vitest';
import { warnIfDevPointsAtProduction } from './devEnvGuard';

describe('devEnvGuard', () => {
  const env = import.meta.env;

  afterEach(() => {
    vi.restoreAllMocks();
    env.DEV = true;
    env.VITE_API_URL = '';
    env.VITE_CLERK_PUBLISHABLE_KEY = '';
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = '';
  });

  it('warns when dev API URL points at Render production', () => {
    env.DEV = true;
    env.VITE_API_URL = 'https://coreknot-api.onrender.com';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    warnIfDevPointsAtProduction();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('[DEV GUARD]'));
    expect(error.mock.calls[0][0]).toContain('coreknot-api.onrender.com');
  });

  it('warns when pk_live is set in development', () => {
    env.DEV = true;
    env.VITE_CLERK_PUBLISHABLE_KEY = 'pk_live_abc';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    warnIfDevPointsAtProduction();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('pk_live_'));
  });

  it('no-op outside development', () => {
    env.DEV = false;
    env.VITE_API_URL = 'https://coreknot-api.onrender.com';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    warnIfDevPointsAtProduction();

    expect(error).not.toHaveBeenCalled();
  });
});
