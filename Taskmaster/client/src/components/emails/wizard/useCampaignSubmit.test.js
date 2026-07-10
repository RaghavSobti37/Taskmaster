import { describe, it, expect } from 'vitest';
import { buildCampaignPayloadFromForm } from './useCampaignSubmit';

describe('buildCampaignPayloadFromForm', () => {
  const templates = [{
    _id: 'tpl1',
    status: 'approved',
    content: '<p>Hello {0}</p>',
    approvedContent: '<p>Hello {0}</p>',
  }];

  it('produces API-compatible payload shape', () => {
    const payload = buildCampaignPayloadFromForm({
      title: 'Test Campaign',
      subject: 'Subject line',
      mailTemplateId: 'tpl1',
      variableMapping: { 0: 'name' },
      senderMode: 'single',
      senderProfileId: 'prof1',
      senderProfileIds: [],
      includeSignature: true,
      includeUnsubscribe: true,
      attachments: [{ filename: 'a.pdf', contentType: 'application/pdf', storageKey: 'key1' }],
    }, templates, [{ name: 'Ada', email: 'ada@example.com', rowData: { name: 'Ada' } }]);

    expect(payload).toMatchObject({
      title: 'Test Campaign',
      subject: 'Subject line',
      content: '<p>Hello {0}</p>',
      mailTemplateId: 'tpl1',
      variableMapping: { 0: 'name' },
      senderMode: 'single',
      senderProfileId: 'prof1',
      senderProfileIds: [],
      includeSignature: true,
      removeUnsubscribe: false,
      leadIds: [],
    });
    expect(payload.customRecipients).toHaveLength(1);
    expect(payload.attachments[0].storageKey).toBe('key1');
  });

  it('sets systemProvider and resendFromEmail for system_resend mode', () => {
    const payload = buildCampaignPayloadFromForm({
      title: 'T',
      subject: 'S',
      mailTemplateId: 'tpl1',
      senderMode: 'system_resend',
      resendFromEmail: 'team@theshakticollective.in',
      includeSignature: false,
      includeUnsubscribe: false,
    }, templates, []);

    expect(payload.systemProvider).toBe('resend');
    expect(payload.resendFromEmail).toBe('team@theshakticollective.in');
    expect(payload.leadIds).toEqual([]);
  });
});
