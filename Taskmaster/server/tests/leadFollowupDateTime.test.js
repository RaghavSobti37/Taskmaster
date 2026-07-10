const { parseLeadFollowupDateTime, formatFollowupScheduleLabel } = require('../utils/leadFollowupDateTime');

describe('leadFollowupDateTime', () => {
  test('parseLeadFollowupDateTime handles 24h time', () => {
    const dt = parseLeadFollowupDateTime({
      nextFollowupDate: '18-06-2026',
      nextFollowupTime: '14:30',
    });
    expect(dt).toBeInstanceOf(Date);
    expect(Number.isNaN(dt.getTime())).toBe(false);
  });

  test('parseLeadFollowupDateTime handles date-only followups', () => {
    const dt = parseLeadFollowupDateTime({ nextFollowupDate: '18-06-2026', nextFollowupTime: '' });
    expect(dt).toBeInstanceOf(Date);
    expect(Number.isNaN(dt.getTime())).toBe(false);
  });

  test('formatFollowupScheduleLabel includes date and time', () => {
    expect(formatFollowupScheduleLabel({
      nextFollowupDate: '18-06-2026',
      nextFollowupTime: '10:00',
    })).toBe('18-06-2026 at 10:00');
  });
});
