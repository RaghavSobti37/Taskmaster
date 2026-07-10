const {
  summarizeDailyCallStats,
  summarizeMonthlyBusinessFromLeads,
  resolveLeadDealValue,
  formatLakhs,
  buildDailyActivityTrend,
  buildPipelineDistributionChart,
} = require('../services/crmDailyStatsService');

describe('crmDailyStatsService', () => {
  test('summarizeDailyCallStats counts calls, connected, meaningful, converted', () => {
    const audits = [
      { leadId: 'a1', fieldChanged: 'callStatus', oldValue: 'Pending', newValue: 'Connected' },
      { leadId: 'a1', fieldChanged: 'meaningfulConnect', oldValue: 'PENDING', newValue: 'YES' },
      { leadId: 'a2', fieldChanged: 'callStatus', oldValue: 'Pending', newValue: 'DNP' },
      { leadId: 'a3', fieldChanged: 'leadStatus', oldValue: 'Warm', newValue: 'Converted' },
    ];
    const stats = summarizeDailyCallStats(audits);
    expect(stats.callsMade).toBe(2);
    expect(stats.connected).toBe(1);
    expect(stats.meaningful).toBe(1);
    expect(stats.converted).toBe(1);
    expect(stats.dnp).toBe(1);
    expect(stats.leadsTouched).toBe(3);
  });

  test('summarizeMonthlyBusinessFromLeads totals closed leads and lakhs value', () => {
    const leads = [
      { planOption: '3 Mo', metadata: {} },
      { planOption: 'One-Time', metadata: { dealValue: 75000 } },
    ];
    const planValueMap = { 'One-Time': 50000, '3 Mo': 45000, '6 Mo': 0, '9 Mo': 0 };
    const summary = summarizeMonthlyBusinessFromLeads(leads, 2, planValueMap);
    expect(summary.leadsClosed).toBe(2);
    expect(summary.totalValueRupees).toBe(120000);
    expect(summary.valueLabel).toBe('1.2 Lakhs');
    expect(summary.targetLabel).toBe('2 Lakhs');
    expect(summary.progressPct).toBe(60);
  });

  test('resolveLeadDealValue prefers metadata over plan map', () => {
    expect(resolveLeadDealValue({ planOption: '3 Mo', metadata: { dealValue: 99000 } }, { '3 Mo': 45000 })).toBe(99000);
    expect(resolveLeadDealValue({ planOption: '6 Mo', metadata: {} }, { '6 Mo': 85000 })).toBe(85000);
  });

  test('formatLakhs renders Indian lakh label', () => {
    expect(formatLakhs(250000)).toBe('2.5 Lakhs');
    expect(formatLakhs(0)).toBe('0 Lakhs');
  });

  test('buildDailyActivityTrend buckets audit logs by day', () => {
    const audits = [
      { leadId: 'a1', fieldChanged: 'callStatus', oldValue: 'Pending', newValue: 'Connected', timestamp: new Date('2026-06-28T10:00:00+05:30') },
      { leadId: 'a2', fieldChanged: 'leadStatus', oldValue: 'Warm', newValue: 'Converted', timestamp: new Date('2026-06-29T11:00:00+05:30') },
    ];
    const trend = buildDailyActivityTrend(audits, 7, '2026-06-29');
    expect(trend).toHaveLength(7);
    expect(trend.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
    const dates = trend.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    const withActivity = trend.filter((d) => d.calls > 0 || d.converted > 0);
    expect(withActivity.length).toBeGreaterThanOrEqual(1);
  });

  test('buildPipelineDistributionChart maps platform overview', () => {
    const chart = buildPipelineDistributionChart({
      all: { totalLeads: 10, connected: 5, meaningful: 3, warmLeads: 2, converted: 1 },
    });
    expect(chart.find((x) => x.label === 'Assigned')?.value).toBe(10);
    expect(chart.find((x) => x.label === 'Converted')?.value).toBe(1);
  });
});
