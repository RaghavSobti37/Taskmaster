import { describe, expect, it } from 'vitest';
import { renderServiceLogsUrl } from './renderLogs';

describe('renderServiceLogsUrl', () => {
  it('builds Render dashboard logs URL from service id', () => {
    expect(renderServiceLogsUrl('srv-abc123')).toBe(
      'https://dashboard.render.com/web/srv-abc123/logs',
    );
  });

  it('returns null when service id missing', () => {
    expect(renderServiceLogsUrl('')).toBeNull();
    expect(renderServiceLogsUrl(null)).toBeNull();
  });
});
