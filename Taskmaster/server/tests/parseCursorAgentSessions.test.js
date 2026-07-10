const {
  parseCursorTimestamp,
  findSessionForCommit,
  allocateCommitInterval,
  extractTimestampsFromText,
} = require('../scripts/lib/parseCursorAgentSessions');

describe('parseCursorTimestamp', () => {
  it('parses Cursor user timestamp with IST offset', () => {
    const d = parseCursorTimestamp('Friday, Jul 3, 2026, 3:11 PM (UTC+5:30)');
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe('2026-07-03T09:41:00.000Z');
  });
});

describe('findSessionForCommit', () => {
  const sessions = [{
    id: 'sess-1',
    startAt: new Date('2026-07-02T14:00:00+05:30'),
    endAt: new Date('2026-07-02T20:00:00+05:30'),
    commitShas: ['3fefffaa'],
    commitMessages: ['fix(daily-log): stop NexusModal outer form from swallowing Log Work submit'],
  }];

  it('matches by short sha in transcript', () => {
    const hit = findSessionForCommit({
      sha: '3fefffaa018537990df8d7738ffa79b43cd75476',
      shortSha: '3fefffaa',
      subject: 'fix(daily-log): stop NexusModal outer form from swallowing Log Work submit',
    }, sessions);
    expect(hit?.matchType).toBe('sha');
  });

  it('matches by commit message in transcript', () => {
    const hit = findSessionForCommit({
      sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shortSha: 'aaaaaaaa',
      subject: 'fix(daily-log): stop NexusModal outer form from swallowing Log Work submit',
    }, sessions);
    expect(hit?.matchType).toBe('message');
  });

  it('returns null without transcript evidence', () => {
    const hit = findSessionForCommit({
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      shortSha: 'bbbbbbbb',
      subject: 'unrelated commit',
    }, sessions);
    expect(hit).toBeNull();
  });
});

describe('allocateCommitInterval', () => {
  const session = {
    startAt: new Date('2026-07-02T19:00:00+05:30'),
    endAt: new Date('2026-07-02T20:00:00+05:30'),
  };

  it('uses session start to first commit time', () => {
    const commitAt = new Date('2026-07-02T19:38:18+05:30');
    const interval = allocateCommitInterval(commitAt, null, session);
    expect(interval).not.toBeNull();
    expect(interval.durationMs).toBeGreaterThanOrEqual(60_000);
  });

  it('rejects first commit when session has no wall-clock start', () => {
    const commitAt = new Date('2026-07-02T19:38:18+05:30');
    expect(allocateCommitInterval(commitAt, null, { startAt: null, endAt: null })).toBeNull();
  });

  it('uses previous commit when session has no wall-clock start', () => {
    const prev = new Date('2026-07-02T19:38:18+05:30');
    const commitAt = new Date('2026-07-02T19:42:25+05:30');
    const interval = allocateCommitInterval(commitAt, prev, { startAt: null, endAt: null });
    expect(interval).not.toBeNull();
    expect(interval.durationMs).toBeGreaterThanOrEqual(60_000);
  });

  it('rejects sub-minute intervals', () => {
    const commitAt = new Date('2026-07-02T19:00:30+05:30');
    expect(allocateCommitInterval(commitAt, null, session)).toBeNull();
  });
});

describe('timestamp extraction', () => {
  it('pulls timestamps from tagged text', () => {
    const times = extractTimestampsFromText(
      '<timestamp>Friday, Jul 3, 2026, 1:07 PM (UTC+5:30)</timestamp>',
    );
    expect(times).toHaveLength(1);
  });
});
