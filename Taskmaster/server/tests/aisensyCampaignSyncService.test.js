const {
  normalizeAisensyStatus,
  normalizeTags,
  parseAisensyWebhookPayload,
  pickHigherStatus,
} = require('../services/aisensyCampaignSyncService');

describe('aisensyCampaignSyncService', () => {
  it('normalizes delivery statuses', () => {
    expect(normalizeAisensyStatus('FAILED')).toBe('failed');
    expect(normalizeAisensyStatus('delivered')).toBe('delivered');
    expect(normalizeAisensyStatus('read')).toBe('read');
  });

  it('keeps higher status on merge', () => {
    expect(pickHigherStatus('delivered', 'read')).toBe('read');
    expect(pickHigherStatus('read', 'failed')).toBe('failed');
    expect(pickHigherStatus('failed', 'delivered')).toBe('failed');
  });

  it('parses flat AISensy payload', async () => {
    const events = await parseAisensyWebhookPayload({
      campaignName: 'Havells mYOUsic Dumka Message 1',
      destination: '+919990887255',
      status: 'failed',
      tags: ['havells', 'dumka'],
      failureReason: 'ecosystem engagement',
    });
    expect(events).toHaveLength(1);
    expect(events[0].phone).toBe('9990887255');
    expect(events[0].status).toBe('failed');
    expect(events[0].tags).toEqual(['havells', 'dumka']);
  });

  it('parses meta whatsapp status webhook', async () => {
    const events = await parseAisensyWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: 'wamid.test',
              status: 'delivered',
              timestamp: '1750263773',
              recipient_id: '919876543210',
            }],
          },
          field: 'messages',
        }],
      }],
    });
    expect(events).toHaveLength(1);
    expect(events[0].phone).toBe('9876543210');
    expect(events[0].status).toBe('delivered');
    expect(events[0].messageId).toBe('wamid.test');
  });

  it('normalizes tag strings', () => {
    expect(normalizeTags('havells, dumka|vip')).toEqual(['havells', 'dumka', 'vip']);
  });
});
