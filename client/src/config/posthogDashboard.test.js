import { describe, expect, it } from 'vitest';
import {
  getPostHogRegion,
  posthogIngestHost,
  posthogUiHost,
} from './posthogDashboard';

describe('posthogDashboard config', () => {
  it('defaults to us region', () => {
    expect(getPostHogRegion()).toBe('us');
    expect(posthogUiHost('us')).toBe('https://us.posthog.com');
    expect(posthogIngestHost('us')).toBe('https://us.i.posthog.com');
  });

  it('supports eu region', () => {
    expect(posthogUiHost('eu')).toBe('https://eu.posthog.com');
    expect(posthogIngestHost('eu')).toBe('https://eu.i.posthog.com');
  });
});
