const STORAGE_KEY = 'tsc_campaign_wizard_draft_v1';

/** Stable JSON key order for deduping autosave writes. */
export const campaignWizardDraftFingerprint = (payload) => JSON.stringify({
  formValues: payload?.formValues ?? {},
  step: payload?.step ?? 1,
  audience: payload?.audience ?? null,
});

export const readCampaignWizardDraft = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeCampaignWizardDraft = (payload) => {
  try {
    const next = {
      ...payload,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
};

export const clearCampaignWizardDraft = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
