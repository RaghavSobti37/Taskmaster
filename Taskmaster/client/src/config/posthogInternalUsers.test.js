import { describe, expect, it } from 'vitest';
import { isPostHogInternalOrTestUser, postHogPersonPropertiesForUser } from '@shared/posthogInternalUsers';

describe('posthogInternalUsers', () => {
  it('flags e2e-agent automation accounts', () => {
    expect(isPostHogInternalOrTestUser('e2e-agent-1733362095236@theshakticollective.in')).toBe(true);
    expect(isPostHogInternalOrTestUser('E2E-AGENT-bot@example.com')).toBe(true);
  });

  it('flags seeded e2e test users', () => {
    expect(isPostHogInternalOrTestUser('e2e-dept-admin@test.coreknot.local')).toBe(true);
  });

  it('does not flag real team emails', () => {
    expect(isPostHogInternalOrTestUser('atharva@theshakticollective.in')).toBe(false);
    expect(isPostHogInternalOrTestUser('admin@test.coreknot.local')).toBe(false);
  });

  it('sets $internal_or_test_user on identify props', () => {
    expect(postHogPersonPropertiesForUser({ email: 'e2e-agent-1@theshakticollective.in', name: 'Bot' }))
      .toEqual({ email: 'e2e-agent-1@theshakticollective.in', name: 'Bot', role: undefined, $internal_or_test_user: true });
    expect(postHogPersonPropertiesForUser({ email: 'siya@theshakticollective.in', name: 'Siya' }))
      .toEqual({ email: 'siya@theshakticollective.in', name: 'Siya', role: undefined });
  });
});
