const {
  summarizeRepActivity,
  buildDigestHtml,
  REP_SECTIONS,
} = require('../services/crmReachOutDigestService');

describe('crmReachOutDigestService', () => {
  test('summarizeRepActivity counts unique leads and fields', () => {
    const audits = [
      { leadId: 'a1', fieldChanged: 'callStatus' },
      { leadId: 'a1', fieldChanged: 'notes' },
      { leadId: 'a2', fieldChanged: 'callStatus' },
    ];
    const summary = summarizeRepActivity(audits);
    expect(summary.totalChanges).toBe(3);
    expect(summary.leadsTouched).toBe(2);
    expect(summary.fieldCounts.callStatus).toBe(2);
    expect(summary.fieldCounts.notes).toBe(1);
  });

  test('buildDigestHtml renders both rep sections', () => {
    const html = buildDigestHtml({
      periodLabel: 'Tuesday, 17 June 2026',
      sections: REP_SECTIONS.map((sectionMeta) => ({
        sectionMeta,
        repUser: { name: sectionMeta.key === 'akash' ? 'Akash' : 'Satyam Mishra' },
        audits: [],
      })),
    });
    expect(html).toContain('Artist Calls');
    expect(html).toContain('Sales &amp; Other Calls');
    expect(html).toContain('No CRM updates recorded');
  });
});
