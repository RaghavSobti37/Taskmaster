import { describe, it, expect } from 'vitest';
import {
  step1Schema, step2Schema, validateVariableMappingComplete,
} from './campaignWizardSchema';

describe('campaignWizardSchema', () => {
  it('step1 requires title, subject, and sender profile for single mode', () => {
    const bad = step1Schema.safeParse({
      title: '',
      subject: 'Hi',
      senderMode: 'single',
      senderProfileId: '',
    });
    expect(bad.success).toBe(false);

    const good = step1Schema.safeParse({
      title: 'May Release',
      subject: 'Hello',
      senderMode: 'single',
      senderProfileId: 'abc123',
    });
    expect(good.success).toBe(true);
  });

  it('step1 requires resendFromEmail for system_resend mode', () => {
    const bad = step1Schema.safeParse({
      title: 'Resend test',
      subject: 'Hi',
      senderMode: 'system_resend',
    });
    expect(bad.success).toBe(false);

    const good = step1Schema.safeParse({
      title: 'Resend test',
      subject: 'Hi',
      senderMode: 'system_resend',
      resendFromEmail: 'artist@theshakticollective.in',
    });
    expect(good.success).toBe(true);
  });

  it('step2 requires mailTemplateId', () => {
    expect(step2Schema.safeParse({ mailTemplateId: '' }).success).toBe(false);
    expect(step2Schema.safeParse({ mailTemplateId: 'tpl_1' }).success).toBe(true);
  });

  it('validateVariableMappingComplete rejects unmapped indices', () => {
    const result = validateVariableMappingComplete(['0', '1'], { 0: 'name' });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('1');
  });

  it('validateVariableMappingComplete passes when all mapped', () => {
    const result = validateVariableMappingComplete(['0', '1'], { 0: 'name', 1: 'email' });
    expect(result.ok).toBe(true);
  });
});
