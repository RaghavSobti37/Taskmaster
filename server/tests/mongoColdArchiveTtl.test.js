const {
  COLD_ARCHIVE_TTL_SECONDS,
  COLD_ARCHIVE_COLLECTIONS,
} = require('../utils/mongoColdArchiveTtl');

describe('mongo cold archive TTL', () => {
  it('uses 90-day retention', () => {
    expect(COLD_ARCHIVE_TTL_SECONDS).toBe(90 * 24 * 60 * 60);
  });

  it('covers all cold-archive collections', () => {
    const models = COLD_ARCHIVE_COLLECTIONS.map((c) => c.model);
    expect(models).toEqual(
      expect.arrayContaining([
        'SystemLog',
        'Log',
        'CRMAudit',
        'MailEvent',
        'QATestRun',
        'TaskActivity',
      ])
    );
    expect(models).toHaveLength(6);
  });
});
