import { describe, expect, it } from 'vitest';
import { formatBootErrorMessage } from './bootErrorMessage';

describe('formatBootErrorMessage', () => {
  it('maps gateway errors to server unavailable copy', () => {
    expect(formatBootErrorMessage({ status: 502 })).toMatch(/temporarily unavailable/i);
  });

  it('maps timeout errors', () => {
    expect(formatBootErrorMessage({ code: 'TIMEOUT' })).toMatch(/timed out/i);
  });

  it('falls back to generic connection copy', () => {
    expect(formatBootErrorMessage(new Error('network'))).toMatch(/Couldn't reach CoreKnot/i);
  });
});
