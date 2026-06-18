const {
  summarizeDailyCallStats,
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

  test('buildDigestHtml renders stat sections without change tables', () => {
    const html = buildDigestHtml({
      periodLabel: 'Tuesday, 17 June 2026',
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
    expect(html).toContain('Calls made');
    expect(html).toContain('Meaningful');
    expect(html).toContain('Assigned pipeline');
    expect(html).not.toContain('Field</th>');
    expect(html).not.toContain('oldValue');
  });
});
