const {
  attributeEventsToBreakdown,
  formatLocationBreakdownRows,
  enrichBreakdownWithCounts,
  collectEngagementEventEmails,
  assertNoUnknownInBreakdown,
} = require('../utils/campaignRegisteredLocation');
const {
  isForbiddenBreakdownLabel,
  formatBreakdownPlaceLabel,
  storedCityFromEvent,
} = require('../utils/geoLookup');

describe('campaignRegisteredLocation', () => {
  test('collectEngagementEventEmails dedupes and normalizes mail event addresses', () => {
    const emails = collectEngagementEventEmails([
      { email: 'A@Test.com' },
      { email: 'a@test.com' },
      { email: ' B@Test.com ' },
      { email: '' },
      {},
    ]);

    expect(emails).toEqual(['a@test.com', 'b@test.com']);
  });

  test('attributeEventsToBreakdown groups opens/clicks by per-event IP city', () => {
    const events = [
      { eventType: 'Open', email: 'a@test.com' },
      { eventType: 'Open', email: 'b@test.com' },
      { eventType: 'Open', email: 'b@test.com' },
      { eventType: 'Click', email: 'a@test.com' },
    ];
    const eventCities = ['Nashik', 'Pune', 'Pune', 'Nashik'];

    const { locationBreakdown, engagedByCity } = attributeEventsToBreakdown(events, eventCities);

    expect(locationBreakdown.Nashik).toEqual({ opens: 1, clicks: 1 });
    expect(locationBreakdown.Pune).toEqual({ opens: 2, clicks: 0 });
    expect(locationBreakdown.Unknown).toBeUndefined();
    expect(engagedByCity.Nashik.size).toBe(1);
    expect(engagedByCity.Pune.size).toBe(1);
  });

  test('formatLocationBreakdownRows filters forbidden labels', () => {
    const enriched = enrichBreakdownWithCounts(
      { Unknown: { opens: 34, clicks: 0 }, Nashik: { opens: 1, clicks: 1 } },
      { Unknown: new Set(['u@test.com']), Nashik: new Set(['a@test.com']) },
    );

    const rows = formatLocationBreakdownRows(enriched);

    expect(rows).toHaveLength(1);
    expect(rows[0].location).toBe('Nashik');
    expect(rows.find((row) => row.location === 'Unknown')).toBeUndefined();
  });

  test('assertNoUnknownInBreakdown fails when Unknown present', () => {
    const result = assertNoUnknownInBreakdown(
      { Unknown: { opens: 1, clicks: 0 } },
      ['Unknown', 'Pune'],
    );
    expect(result.ok).toBe(false);
    expect(result.badLabels).toContain('Unknown');
    expect(result.badEventCount).toBe(1);
  });
});

describe('geoLookup breakdown helpers', () => {
  test('isForbiddenBreakdownLabel rejects unknown variants', () => {
    expect(isForbiddenBreakdownLabel('Unknown')).toBe(true);
    expect(isForbiddenBreakdownLabel('unknown city')).toBe(true);
    expect(isForbiddenBreakdownLabel('Nashik')).toBe(false);
  });

  test('formatBreakdownPlaceLabel prefers city then region-country', () => {
    expect(formatBreakdownPlaceLabel({ city: 'Nashik', region: 'MH', country: 'IN' })).toBe('Nashik');
    expect(formatBreakdownPlaceLabel({ city: null, region: 'Maharashtra', country: 'IN' })).toBe('Maharashtra, IN');
  });

  test('storedCityFromEvent reads webhook location fields', () => {
    expect(storedCityFromEvent({ location: { city: 'Jaipur' } })).toBe('Jaipur');
    expect(storedCityFromEvent({ metadata: { city: 'Udaipur' } })).toBe('Udaipur');
    expect(storedCityFromEvent({ metadata: { location: 'Kota, Rajasthan, IN' } })).toBe('Kota');
  });
});
