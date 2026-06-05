import { cloneSnapshot, stableJsonEqual } from '../hooks/useUnsavedChanges';

export const EMPTY_WIZARD_SNAPSHOT = {
  campaignStep: 1,
  title: '',
  subject: '',
  content: '',
  senderProfileId: '',
  senderMode: 'single',
  senderProfileIds: [],
  includeSignature: false,
  includeUnsubscribe: false,
  selectedLeadIds: [],
  csvRecipients: [],
  attachments: [],
  excludedSources: [],
  excludedEmails: [],
  isCustomHtml: false,
  useRawHtml: false,
  selectedTemplateId: '',
  variableMapping: {},
  testCampaignEmail: '',
};

/** Full editable wizard state for baseline storage (includes attachment objects). */
export function buildWizardEditableState(state) {
  return {
    campaignStep: state.campaignStep ?? 1,
    title: state.title || '',
    subject: state.subject || '',
    content: state.content || '',
    senderProfileId: state.senderProfileId || '',
    senderMode: state.senderMode || 'single',
    senderProfileIds: [...(state.senderProfileIds || [])],
    includeSignature: !!state.includeSignature,
    includeUnsubscribe: !!state.includeUnsubscribe,
    selectedLeadIds: [...(state.selectedLeadIds || [])],
    csvRecipients: [...(state.csvRecipients || [])],
    attachments: [...(state.attachments || [])],
    excludedSources: [...(state.excludedSources || [])],
    excludedEmails: [...(state.excludedEmails || [])],
    isCustomHtml: !!state.isCustomHtml,
    useRawHtml: !!state.useRawHtml,
    selectedTemplateId: state.selectedTemplateId || '',
    variableMapping: { ...(state.variableMapping || {}) },
    testCampaignEmail: state.testCampaignEmail || '',
  };
}

export function snapshotMailCampaignWizard(state) {
  return {
    campaignStep: state.campaignStep ?? 1,
    title: state.title || '',
    subject: state.subject || '',
    content: state.content || '',
    senderProfileId: state.senderProfileId || '',
    senderMode: state.senderMode || 'single',
    senderProfileIds: [...(state.senderProfileIds || [])].sort(),
    includeSignature: !!state.includeSignature,
    includeUnsubscribe: !!state.includeUnsubscribe,
    selectedLeadIds: [...(state.selectedLeadIds || [])].map(String).sort(),
    csvRecipients: state.csvRecipients || [],
    attachments: (state.attachments || []).map((a) => a.name || a.filename || a.url || JSON.stringify(a)),
    excludedSources: [...(state.excludedSources || [])].sort(),
    excludedEmails: [...(state.excludedEmails || [])].sort(),
    isCustomHtml: !!state.isCustomHtml,
    useRawHtml: !!state.useRawHtml,
    selectedTemplateId: state.selectedTemplateId || '',
    variableMapping: state.variableMapping || {},
    testCampaignEmail: state.testCampaignEmail || '',
  };
}

export function wizardHasChanges(current, baseline) {
  return !stableJsonEqual(
    snapshotMailCampaignWizard(current),
    snapshotMailCampaignWizard(baseline)
  );
}

export function applyWizardEditableState(state, setters) {
  const snap = cloneWizardSnapshot(state);
  setters.setCampaignStep(snap.campaignStep ?? 1);
  setters.setTitle(snap.title || '');
  setters.setSubject(snap.subject || '');
  setters.setContent(snap.content || '');
  setters.setSenderProfileId(snap.senderProfileId || '');
  setters.setSenderMode(snap.senderMode || 'single');
  setters.setSenderProfileIds(snap.senderProfileIds || []);
  setters.setIncludeSignature(!!snap.includeSignature);
  setters.setIncludeUnsubscribe(!!snap.includeUnsubscribe);
  setters.setSelectedLeadIds(snap.selectedLeadIds || []);
  setters.setCsvRecipients(snap.csvRecipients || []);
  setters.setAttachments(snap.attachments || []);
  setters.setExcludedSources(snap.excludedSources || []);
  setters.setExcludedEmails(snap.excludedEmails || []);
  setters.setIsCustomHtml(!!snap.isCustomHtml);
  setters.setUseRawHtml(!!snap.useRawHtml);
  setters.setSelectedTemplateId(snap.selectedTemplateId || '');
  setters.setVariableMapping(snap.variableMapping || {});
  setters.setTestCampaignEmail(snap.testCampaignEmail || '');
}

export function cloneWizardSnapshot(snapshot) {
  return cloneSnapshot(snapshot ?? EMPTY_WIZARD_SNAPSHOT);
}
