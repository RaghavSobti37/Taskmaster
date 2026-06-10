const {
  attributeEventsToBreakdown,
  attributeRecipientsToBreakdown,
  formatLocationBreakdownRows,
  enrichBreakdownWithCounts,
} = require('../utils/campaignRegisteredLocation');

describe('campaignRegisteredLocation', () => {
  test('attributeEventsToBreakdown groups opens/clicks by CRM city with unique counts', () => {
    const emailCityMap = new Map([
      ['a@test.com', 'Nashik'],
      ['b@test.com', 'Unknown'],
    ]);
    const events = [
      { eventType: 'Open', email: 'a@test.com' },
      { eventType: 'Open', email: 'b@test.com' },
      { eventType: 'Open', email: 'b@test.com' },
      { eventType: 'Click', email: 'a@test.com' },
    ];

    const { locationBreakdown, engagedByCity } = attributeEventsToBreakdown(events, emailCityMap);

    expect(locationBreakdown.Nashik).toEqual({ opens: 1, clicks: 1 });
    expect(locationBreakdown.Unknown).toEqual({ opens: 2, clicks: 0 });
    expect(engagedByCity.Nashik.size).toBe(1);
    expect(engagedByCity.Unknown.size).toBe(1);
  });

  test('attributeRecipientsToBreakdown uses recipient CRM city when MailEvents are absent', () => {
    const emailCityMap = new Map([['known@test.com', 'Pune']]);
    const recipients = [
      { email: 'known@test.com', status: 'Opened' },
      { email: 'missing@test.com', status: 'Clicked', leadId: { city: 'Nashik' } },
      { email: 'idle@test.com', status: 'Sent' },
    ];

    const { locationBreakdown, engagedByCity } = attributeRecipientsToBreakdown(recipients, emailCityMap);

    expect(locationBreakdown.Pune).toEqual({ opens: 1, clicks: 0 });
    expect(locationBreakdown.Nashik).toEqual({ opens: 1, clicks: 1 });
    expect(engagedByCity.Pune.size).toBe(1);
    expect(engagedByCity.Nashik.size).toBe(1);
    expect(locationBreakdown.Unknown).toBeUndefined();
  });

  test('formatLocationBreakdownRows includes engaged count and filters empty rows', () => {
    const enriched = enrichBreakdownWithCounts(
      { Unknown: { opens: 34, clicks: 0 }, Nashik: { opens: 1, clicks: 1 } },
      { Unknown: new Set(Array.from({ length: 34 }, (_, i) => `u${i}@test.com`)), Nashik: new Set(['a@test.com']) },
    );

    const rows = formatLocationBreakdownRows(enriched);

    expect(rows).toHaveLength(2);
    expect(rows[0].location).toBe('Unknown');
    expect(rows[0].count).toBe(34);
    expect(rows[0].opens).toBe(34);
    expect(rows.find((row) => row.location === 'Nashik')).toMatchObject({ count: 1, opens: 1, clicks: 1 });
  });
});
