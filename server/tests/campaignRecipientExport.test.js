const {
  resolveRecipientExportFields,
  filterCampaignRecipients,
  recipientsToCsv,
  buildRecipientExportFilename,
} = require('../utils/campaignRecipientExport');

describe('campaignRecipientExport', () => {
  test('resolveRecipientExportFields prefers rowData phone and falls back to lead', () => {
    const fromRow = resolveRecipientExportFields({
      name: 'Ada',
      email: 'ada@example.com',
      rowData: { phone: '+919876543210', name: 'Row Name' },
    });
    expect(fromRow).toEqual({
      name: 'Ada',
      number: '+919876543210',
      email: 'ada@example.com',
    });

    const fromLead = resolveRecipientExportFields(
      { email: 'bob@example.com', leadId: 'abc' },
      { name: 'Bob Lead', phone: '+911234567890', email: 'bob@example.com' },
    );
    expect(fromLead).toEqual({
      name: 'Bob Lead',
      number: '+911234567890',
      email: 'bob@example.com',
    });
  });

  test('resolveRecipientExportFields reads number column from CSV rowData', () => {
    const row = resolveRecipientExportFields({
      email: 'csv@example.com',
      rowData: { name: 'CSV Person', number: '9876543210', email: 'csv@example.com' },
    });
    expect(row.number).toBe('9876543210');
    expect(row.name).toBe('CSV Person');
  });

  test('filterCampaignRecipients respects status and hideInvalid', () => {
    const recipients = [
      { email: 'bounced@test.com', status: 'Bounced' },
      { email: 'failed@test.com', status: 'Failed' },
      { email: 'bad-phone', status: 'Invalid' },
      { email: 'opened@test.com', status: 'Opened' },
      { email: 'unsub@test.com', status: 'Unsubscribed' },
    ];

    const bounced = filterCampaignRecipients(recipients, { statusFilter: 'bounced', hideInvalid: false });
    expect(bounced.recipients).toHaveLength(3);
    expect(bounced.recipients.map((r) => r.email)).toEqual([
      'bounced@test.com',
      'failed@test.com',
      'bad-phone',
    ]);

    const bouncedValidOnly = filterCampaignRecipients(recipients, { statusFilter: 'bounced', hideInvalid: true });
    expect(bouncedValidOnly.recipients).toHaveLength(2);
    expect(bouncedValidOnly.recipients.map((r) => r.email)).toEqual(['bounced@test.com', 'failed@test.com']);

    const unsub = filterCampaignRecipients(recipients, { statusFilter: 'unsubscribed', hideInvalid: false });
    expect(unsub.recipients).toHaveLength(1);
    expect(unsub.recipients[0].email).toBe('unsub@test.com');
  });

  test('recipientsToCsv escapes quotes and newlines', () => {
    const csv = recipientsToCsv([
      { name: 'Jane "DJ" Doe', number: '+911111111111', email: 'jane@test.com' },
    ]);
    expect(csv).toBe('"name","number","email"\n"Jane ""DJ"" Doe","+911111111111","jane@test.com"');
  });

  test('buildRecipientExportFilename sanitizes title and filter', () => {
    const filename = buildRecipientExportFilename('Summer Launch! [VIP]', 'bounced', new Date('2026-06-11T12:00:00Z'));
    expect(filename).toBe('summer-launch-vip-bounced-2026-06-11.csv');
  });
});
