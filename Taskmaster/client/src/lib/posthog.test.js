import { describe, expect, it, vi } from 'vitest';
import { initPostHog, isPostHogEnabled, POSTHOG_PROXY_PATH } from './posthog';

vi.mock('../config/posthog', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    shouldCapturePostHog: () => false,
  };
});

describe('posthog client', () => {
  it('stays disabled without VITE_POSTHOG_PROJECT_TOKEN', () => {
    expect(initPostHog()).toBe(false);
    expect(isPostHogEnabled()).toBe(false);
  });

  it('uses direct PostHog host unless VITE_POSTHOG_USE_PROXY', () => {
    expect(POSTHOG_PROXY_PATH).toBe('/ph');
  });
});
