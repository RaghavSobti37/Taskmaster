import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readCampaignWizardDraft,
  writeCampaignWizardDraft,
  clearCampaignWizardDraft,
  campaignWizardDraftFingerprint,
} from './campaignWizardDraftStorage';

describe('campaignWizardDraftStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = value; },
      removeItem(key) { delete this.store[key]; },
    });
    clearCampaignWizardDraft();
  });

  it('round-trips wizard draft payload', () => {
    writeCampaignWizardDraft({
      formValues: { title: 'Test campaign', subject: 'Hello' },
      step: 2,
      audience: { audienceSource: 'csv' },
    });
    const draft = readCampaignWizardDraft();
    expect(draft.formValues.title).toBe('Test campaign');
    expect(draft.step).toBe(2);
    expect(draft.audience.audienceSource).toBe('csv');
    expect(draft.savedAt).toBeTruthy();
  });

  it('fingerprint is stable for identical draft payloads', () => {
    const payload = {
      formValues: { title: 'A', subject: 'B' },
      step: 2,
      audience: { audienceSource: 'crm' },
    };
    expect(campaignWizardDraftFingerprint(payload)).toBe(campaignWizardDraftFingerprint({ ...payload }));
  });
});
