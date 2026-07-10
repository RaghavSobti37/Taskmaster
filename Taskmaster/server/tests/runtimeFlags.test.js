const {
  cronJobsEnabled,
  isLightweightMode,
  backgroundIntervalsEnabled,
  healthProbeLoopEnabled,
} = require('../utils/runtimeFlags');

describe('runtimeFlags', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('lightweight mode disables cron and interval loops', () => {
    process.env.COREKNOT_LIGHTWEIGHT = 'true';
    expect(isLightweightMode()).toBe(true);
    expect(cronJobsEnabled()).toBe(false);
    expect(backgroundIntervalsEnabled()).toBe(false);
    expect(healthProbeLoopEnabled()).toBe(false);
  });

  it('cron enabled by default when lightweight unset', () => {
    delete process.env.COREKNOT_LIGHTWEIGHT;
    delete process.env.COREKNOT_DISABLE_CRON;
    expect(cronJobsEnabled()).toBe(true);
  });
});
