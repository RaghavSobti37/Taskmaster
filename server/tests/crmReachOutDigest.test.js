const {
  summarizeDailyCallStats,
  summarizeMonthlyBusinessFromLeads,
  resolveLeadDealValue,
  formatLakhs,
  buildDigestHtml,
  REP_SECTIONS,
} = require('../services/crmReachOutDigestService');

describe('crmReachOutDigestService', () => {
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

  test('parseRecipientEmails splits comma and semicolon lists', () => {
    const { parseRecipientEmails } = require('../services/crmReachOutDigestService');
    expect(parseRecipientEmails('a@x.com,b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(parseRecipientEmails('a@x.com; b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(parseRecipientEmails(['a@x.com', 'b@x.com'])).toEqual(['a@x.com', 'b@x.com']);
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

  test('buildDigestHtml renders stat sections without change tables', () => {
    const html = buildDigestHtml({
      periodLabel: 'Tuesday, 17 June 2026',
      monthlyBusiness: {
        monthLabel: 'June 2026',
        academy: {
          title: 'Academy business (month)',
          projectName: 'TSC Academy',
          leadsClosed: 4,
          valueLabel: '3.5 Lakhs',
          targetLabel: '10 Lakhs',
          targetLakhs: 10,
          progressPct: 35,
        },
        films: {
          title: 'Artist business (month)',
          projectName: 'TSC Films',
          leadsClosed: 2,
          valueLabel: '1.2 Lakhs',
          targetLabel: '5 Lakhs',
          targetLakhs: 5,
          progressPct: 24,
        },
      },
      sections: REP_SECTIONS.map((sectionMeta) => ({
        sectionMeta,
        repUser: { name: sectionMeta.key === 'akash' ? 'Akash' : 'Satyam Mishra' },
        dailyStats: {
          callsMade: 12,
          connected: 5,
          meaningful: 3,
          converted: 1,
          busy: 2,
          dnp: 4,
          followupsSet: 6,
          notesAdded: 2,
          leadsTouched: 14,
        },
        pipelineStats: {
          totalLeads: 100,
          connected: 20,
          meaningful: 15,
          warmLeads: 15,
          converted: 8,
          conversionRate: 8,
        },
      })),
    });
    expect(html).toContain('Artist Calls');
    expect(html).toContain('Sales &amp; Other Calls');
    expect(html).toContain('Business done in the month');
    expect(html).toContain('Leads closed');
    expect(html).toContain('Academy business');
    expect(html).toContain('Artist business');
    expect(html).toContain('Calls made');
    expect(html).toContain('Meaningful');
    expect(html).toContain('Assigned pipeline');
    expect(html).not.toContain('Field</th>');
    expect(html).not.toContain('oldValue');
  });
});
