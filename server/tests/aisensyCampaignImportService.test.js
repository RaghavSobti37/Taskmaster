const {
  inferStatusFromFilename,
  inferCampaignNameFromFilename,
  mapAisensyRow,
} = require('../services/aisensyCampaignImportService');

describe('aisensyCampaignImportService', () => {
  it('infers failed status and campaign name from AiSensy export filename', () => {
    const file = 'Havells mYOUsic Dumka Message 1 FAILED AUDIENCE FAILED AUDIENCE.csv';
    expect(inferStatusFromFilename(file)).toBe('failed');
    expect(inferCampaignNameFromFilename(file)).toBe('Havells mYOUsic Dumka Message 1');
  });

  it('maps failed audience row with phone and failure reason', () => {
    const mapped = mapAisensyRow(
      {
        Name: 'Akanksha',
        'Mobile Number': '+919990887255',
        'Sent At': '',
        'Failure Reason': 'This message was not delivered to maintain healthy ecosystem engagement.',
      },
      { defaultStatus: 'failed' }
    );
    expect(mapped.name).toBe('Akanksha');
    expect(mapped.phone).toBe('9990887255');
    expect(mapped.status).toBe('failed');
    expect(mapped.failureReason).toContain('healthy ecosystem');
  });

  it('overrides default status when status column present', () => {
    const mapped = mapAisensyRow(
      { Name: 'Bob', 'Mobile Number': '9876543210', Status: 'Delivered' },
      { defaultStatus: 'failed' }
    );
    expect(mapped.status).toBe('delivered');
  });
});
