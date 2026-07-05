import { describe, expect, it } from 'vitest';
import {
  getPostHogAppUrl,
  getPostHogProjectId,
  isPostHogCaptureConfigured,
  isPostHogDashboardReady,
  POSTHOG_PROJECT_ID_DEFAULT,
  shouldCapturePostHog,
} from './posthog';

describe('posthog config', () => {
  it('defaults to CoreKnot project id', () => {
    expect(getPostHogProjectId()).toBe(POSTHOG_PROJECT_ID_DEFAULT);
  });

  it('builds dashboard URLs with optional path', () => {
    expect(getPostHogAppUrl()).toContain(`/project/${POSTHOG_PROJECT_ID_DEFAULT}`);
    expect(getPostHogAppUrl('dashboards')).toContain('/dashboards');
  });

  it('dashboard links work without capture token', () => {
    expect(isPostHogDashboardReady()).toBe(true);
    expect(isPostHogCaptureConfigured()).toBe(
      Boolean(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || import.meta.env.VITE_POSTHOG_KEY),
    );
  });

  it('blocks capture on localhost and preview hosts', () => {
    expect(shouldCapturePostHog('localhost')).toBe(false);
    expect(shouldCapturePostHog('127.0.0.1')).toBe(false);
    expect(shouldCapturePostHog('taskmaster-git-staging.vercel.app')).toBe(false);
    expect(shouldCapturePostHog('tsccoreknot.com')).toBe(import.meta.env.PROD);
  });
});
