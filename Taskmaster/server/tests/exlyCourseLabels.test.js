const {
  shortCourseName,
  shortMentorName,
  coursePriceFromLead,
  aggregateCourseEnrollments,
} = require('../utils/exlyCourseLabels');

describe('exlyCourseLabels', () => {
  it('shortens Core Tribe course titles', () => {
    expect(
      shortCourseName('Core Tribe Comprehensive Program - One Time Payment ₹75,000'),
    ).toBe('Core Tribe');
  });

  it('extracts Sandesh mentor short name', () => {
    expect(shortMentorName('Sandesh Shandilya')).toBe('Sandesh');
    expect(shortMentorName('Prasad Khaparde')).toBe('Prasad');
  });

  it('reads price from lead metadata', () => {
    const { priceLabel, priceInr } = coursePriceFromLead({
      planOption: 'One-Time',
      metadata: { dealValue: 75000 },
      exlyOfferingTitle: 'Core Tribe - Early Bird',
    });
    expect(priceInr).toBe(75000);
    expect(priceLabel).toBe('₹75,000');
  });

  it('aggregates enrollments by short name and price', () => {
    const rows = aggregateCourseEnrollments([
      { shortName: 'Core Tribe', priceLabel: '₹75,000', priceInr: 75000 },
      { shortName: 'Core Tribe', priceLabel: '₹75,000', priceInr: 75000 },
      { shortName: 'Core Tribe', priceLabel: '₹49,999', priceInr: 49999 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shortName: 'Core Tribe', priceLabel: '₹75,000', count: 2 });
  });
});
