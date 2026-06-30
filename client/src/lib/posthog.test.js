import { describe, expect, it } from 'vitest';
import { initPostHog, isPostHogEnabled, POSTHOG_PROXY_PATH } from './posthog';

describe('posthog client', () => {
  it('stays disabled without VITE_POSTHOG_PROJECT_TOKEN', () => {
    expect(initPostHog()).toBe(false);
    expect(isPostHogEnabled()).toBe(false);
  });

  it('uses same-origin proxy path for production builds', () => {
    expect(POSTHOG_PROXY_PATH).toBe('/ph');
  });
});
