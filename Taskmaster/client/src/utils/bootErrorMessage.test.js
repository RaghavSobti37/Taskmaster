import { describe, expect, it } from 'vitest';
import { formatBootError, formatBootErrorMessage } from './bootErrorMessage';

describe('formatBootError', () => {
  it('maps gateway errors to server unavailable copy', () => {
    const result = formatBootError({ status: 503 });
    expect(result.summary).toMatch(/server did not respond/i);
    expect(result.statusCode).toBe(503);
    expect(result.showHealthyBadge).toBe(true);
  });

  it('maps timeout errors', () => {
    const result = formatBootError({ code: 'TIMEOUT' });
    expect(result.summary).toMatch(/timed out/i);
  });

  it('falls back to generic connection copy', () => {
    const result = formatBootError(new Error('network'));
    expect(result.summary).toMatch(/Could not reach CoreKnot/i);
  });
});

describe('formatBootErrorMessage', () => {
  it('returns summary string for legacy callers', () => {
    expect(formatBootErrorMessage({ status: 502 })).toMatch(/server did not respond/i);
  });
});
