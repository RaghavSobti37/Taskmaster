import { describe, expect, it } from 'vitest';
import { initPostHog, isPostHogEnabled } from './posthog';

describe('posthog client', () => {
  it('stays disabled without VITE_POSTHOG_PROJECT_TOKEN', () => {
    expect(initPostHog()).toBe(false);
    expect(isPostHogEnabled()).toBe(false);
  });
});
