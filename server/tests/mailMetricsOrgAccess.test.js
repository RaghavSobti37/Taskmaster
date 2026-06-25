const fs = require('fs');
const path = require('path');

describe('org-wide mail metrics access', () => {
  const metricsPath = path.join(__dirname, '../domains/mail/services/mailMetricsService.js');
  const rollupPath = path.join(__dirname, '../domains/mail/services/mailRollupStore.js');
  const metricsSource = fs.readFileSync(metricsPath, 'utf8');
  const rollupSource = fs.readFileSync(rollupPath, 'utf8');

  it('does not scope cumulative tag metrics to campaign creator', () => {
    expect(metricsSource).not.toMatch(/getCumulativeTagMetrics[\s\S]*createdBy/);
    expect(rollupSource).not.toMatch(/computeCumulativeMetricsForUser[\s\S]*createdBy/);
  });

  it('counts bounces across all org campaigns', () => {
    const bounceBlock = metricsSource.split('countUserCampaignBounces')[1]?.split('module.exports')[0] || '';
    expect(bounceBlock).not.toMatch(/createdBy/);
  });
});
