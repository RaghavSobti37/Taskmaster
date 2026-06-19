const {
  parseAnalyticsCsvText,
  parseMetricNumber,
  parseGrowthMetric,
  buildInstagramAnalytics,
  detectAnalyticsSheetTemplate,
} = require('../domains/artists/services/artistAnalyticsSheetImportService');

describe('artistAnalyticsSheetImport', () => {
  const sampleCsv = `Metric,June 2026
Followers,"27,254"
Follower Growth,0.0041
Avg Likes,684
Likes Growth,0.3041
Engagement Rate,2.51%
Avg Reel Plays,"38,200"
Avg Reel Likes,"1,800"
Avg Reel Comments,28
Avg Reel Shares,26
Avg Story Reach,"122,000"
Avg Story Impressions,"145,200"
Female Audience %,25.98%
Male Audience %,74.02%
Age 18-24,19.93%
Age 25-34,56.73%
Age 35-44,18.09%
India Audience,97.76%
Nashik Audience,32.12%
Pune Audience,12.17%
Top Audience Interests,
Interest,%
Camera & Photography,52.49%
Music,39.48%`;

  test('detects analytics templates from filename', () => {
    expect(detectAnalyticsSheetTemplate('YUGM __ TSC Artist Mastersheet - Analytics.csv')?.id).toBe('yugm_analytics');
    expect(detectAnalyticsSheetTemplate('harshaDuhita Collective __ TSC Talent Mastersheet - Analytics.csv')?.id).toBe('hd_analytics');
  });

  test('parseMetricNumber handles commas and percent', () => {
    expect(parseMetricNumber('27,254')).toBe(27254);
    expect(parseMetricNumber('2.51%')).toBe(2.51);
  });

  test('parseGrowthMetric treats decimal as ratio and percent string as percent', () => {
    expect(parseGrowthMetric('0.0041')).toBe(0.41);
    expect(parseGrowthMetric('-0.66%')).toBe(-0.66);
  });

  test('parseAnalyticsCsvText extracts metrics, period, and interests', () => {
    const parsed = parseAnalyticsCsvText(sampleCsv);
    expect(parsed.periodLabel).toBe('June 2026');
    expect(parsed.metrics.Followers).toBe('27,254');
    expect(parsed.interests).toEqual([
      { name: 'Camera & Photography', pct: 52.49 },
      { name: 'Music', pct: 39.48 },
    ]);
  });

  test('buildInstagramAnalytics maps sheet rows to instagram analytics', () => {
    const { metrics, interests } = parseAnalyticsCsvText(sampleCsv);
    const ig = buildInstagramAnalytics(metrics, interests);
    expect(ig.followers).toBe(27254);
    expect(ig.engagementRate).toBe(2.51);
    expect(ig.followerVelocity).toBe(0.41);
    expect(ig.reelsPerformance.views).toBe(38200);
    expect(ig.stories.reach).toBe(122000);
    expect(ig.demographics.geo.cities.Nashik).toBe(32.12);
    expect(ig.demographics.interests[0].name).toBe('Camera & Photography');
  });
});
