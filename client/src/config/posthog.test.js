import { describe, expect, it } from 'vitest';
import {
  getPostHogAppUrl,
  getPostHogProjectId,
  isPostHogCaptureConfigured,
  isPostHogDashboardReady,
  POSTHOG_PROJECT_ID_DEFAULT,
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
});
