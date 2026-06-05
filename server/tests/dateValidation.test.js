const {
  toDateKey,
  getTodayDateKey,
  assertDateKeyNotBeforeToday,
  validateTaskTimelineFields,
} = require('../../shared/dateValidation');
const { validateCalendarEventRange, buildDateTimeFromParts } = require('../utils/dateValidation');

describe('dateValidation', () => {
  it('compares date keys as yyyy-MM-dd strings', () => {
    expect(assertDateKeyNotBeforeToday('2099-01-01').ok).toBe(true);
    expect(assertDateKeyNotBeforeToday('2000-01-01').ok).toBe(false);
  });

  it('rejects past task timeline fields', () => {
    const result = validateTaskTimelineFields({
      scheduleDate: '2000-01-01',
      dueDate: '2099-01-01',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Start date cannot be in the past/);
  });

  it('allows today for task timeline fields', () => {
    const today = getTodayDateKey();
    expect(validateTaskTimelineFields({ scheduleDate: today, dueDate: today }).ok).toBe(true);
  });

  it('rejects calendar events in the past', () => {
    const result = validateCalendarEventRange({
      startDate: '2000-01-01',
      startTime: '09:00',
      endDate: '2000-01-01',
      endTime: '10:00',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot be in the past/);
  });

  it('normalizes ISO values to date keys', () => {
    const key = toDateKey('2026-06-02');
    expect(key).toBe('2026-06-02');
  });

  it('re-exports buildDateTimeFromParts for calendar task mapping', () => {
    expect(typeof buildDateTimeFromParts).toBe('function');
    const atNine = buildDateTimeFromParts('2026-06-05', '09:00');
    expect(atNine).toBeInstanceOf(Date);
    expect(atNine.toISOString()).toBe('2026-06-05T03:30:00.000Z');
  });
});
