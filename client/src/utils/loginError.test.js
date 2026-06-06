import { describe, it, expect } from 'vitest';
import { formatLoginError } from './loginError';

describe('formatLoginError', () => {
  it('returns network message when response missing', () => {
    const result = formatLoginError(new Error('Network Error'));
    expect(result.isNetwork).toBe(true);
    expect(result.message).toMatch(/could not reach/i);
  });

  it('surfaces server error body', () => {
    const result = formatLoginError({
      response: { status: 401, data: { error: 'Invalid email or password' } },
    });
    expect(result.message).toBe('Invalid email or password');
  });

  it('maps proxy 502 to service unavailable copy', () => {
    const result = formatLoginError({
      response: { status: 502, data: '<html>Bad Gateway</html>' },
    });
    expect(result.isNetwork).toBe(true);
    expect(result.message).toMatch(/could not reach the login api/i);
  });

  it('maps 429 to rate limit copy', () => {
    const result = formatLoginError({
      response: { status: 429, data: {} },
    });
    expect(result.message).toMatch(/too many login attempts/i);
  });
});
