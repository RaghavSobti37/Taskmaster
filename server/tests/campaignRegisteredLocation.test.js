const {
  attributeEventsToBreakdown,
  formatLocationBreakdownRows,
  enrichBreakdownWithCounts,
  collectEngagementEventEmails,
  assertNoUnknownInBreakdown,
} = require('../utils/campaignRegisteredLocation');
const {
  isForbiddenBreakdownLabel,
  isDatacenterCityLabel,
  isBreakdownPlaceLabel,
  formatBreakdownPlaceLabel,
  storedCityFromEvent,
  isUntrustedEventForGeo,
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

  test('attributeEventsToBreakdown groups opens/clicks by trusted city labels', () => {
    const events = [
      { eventType: 'Open', email: 'a@test.com' },
      { eventType: 'Open', email: 'b@test.com' },
      { eventType: 'Click', email: 'a@test.com' },
      { eventType: 'Open', email: 'c@test.com' },
    ];
    const eventCities = ['Nashik', 'Pune', 'Nashik', 'Global'];

    const { locationBreakdown, engagedByCity } = attributeEventsToBreakdown(events, eventCities);

    expect(locationBreakdown.Nashik).toEqual({ opens: 1, clicks: 1 });
    expect(locationBreakdown.Pune).toEqual({ opens: 1, clicks: 0 });
    expect(locationBreakdown.Global).toBeUndefined();
    expect(engagedByCity.Nashik.size).toBe(1);
  });

  test('formatLocationBreakdownRows filters datacenter and country-code labels', () => {
    const enriched = enrichBreakdownWithCounts(
      {
        'Mountain View': { opens: 50, clicks: 0 },
        US: { opens: 20, clicks: 0 },
        Nashik: { opens: 1, clicks: 1 },
      },
      {
        'Mountain View': new Set(['x@test.com']),
        US: new Set(['y@test.com']),
        Nashik: new Set(['a@test.com']),
      },
    );

    const rows = formatLocationBreakdownRows(enriched);

    expect(rows).toHaveLength(1);
    expect(rows[0].location).toBe('Nashik');
  });

  test('assertNoUnknownInBreakdown fails on Global and datacenter labels', () => {
    const result = assertNoUnknownInBreakdown(
      { Global: { opens: 1, clicks: 0 }, 'Mountain View': { opens: 2, clicks: 0 } },
      ['Pune'],
    );
    expect(result.ok).toBe(false);
    expect(result.badLabels).toContain('Global');
    expect(result.badLabels).toContain('Mountain View');
  });
});

describe('geoLookup breakdown helpers', () => {
  test('isForbiddenBreakdownLabel rejects unknown and country codes', () => {
    expect(isForbiddenBreakdownLabel('Unknown')).toBe(true);
    expect(isForbiddenBreakdownLabel('GB')).toBe(true);
    expect(isForbiddenBreakdownLabel('Global')).toBe(true);
    expect(isForbiddenBreakdownLabel('Nashik')).toBe(false);
  });

  test('isDatacenterCityLabel flags Mountain View and Boardman', () => {
    expect(isDatacenterCityLabel('Mountain View')).toBe(true);
    expect(isDatacenterCityLabel('Boardman')).toBe(true);
    expect(isDatacenterCityLabel('Pune')).toBe(false);
    expect(isDatacenterCityLabel('Gūduvāncheri')).toBe(false);
  });

  test('formatBreakdownPlaceLabel returns city only, not country codes', () => {
    expect(formatBreakdownPlaceLabel({ city: 'Nashik', region: 'MH', country: 'IN' })).toBe('Nashik');
    expect(formatBreakdownPlaceLabel({ city: null, region: null, country: 'GB' })).toBeNull();
  });

  test('isUntrustedEventForGeo flags Gmail image proxy opens', () => {
    expect(isUntrustedEventForGeo({
      eventType: 'Open',
      userAgent: 'GoogleImageProxy',
      ipAddress: '66.249.1.1',
    })).toBe(true);
  });

  test('storedCityFromEvent rejects datacenter stored cities', () => {
    expect(storedCityFromEvent({ location: { city: 'Mountain View' } })).toBeNull();
    expect(storedCityFromEvent({ location: { city: 'Jaipur' } })).toBe('Jaipur');
  });
});
