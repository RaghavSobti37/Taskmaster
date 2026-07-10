const { resolveTaskSpan } = require('../../shared/scheduleTaskDates');

function getTaskPlacement(task, dateKeys) {
  if (dateKeys.length === 0) return null;
  const span = resolveTaskSpan(task);
  if (!span) return null;
  const visibleStart = dateKeys[0];
  const visibleEnd = dateKeys[dateKeys.length - 1];
  if (span.end < visibleStart || span.start > visibleEnd) return null;
  const clippedStart = span.start < visibleStart ? visibleStart : span.start;
  const clippedEnd = span.end > visibleEnd ? visibleEnd : span.end;
  const startIndex = dateKeys.indexOf(clippedStart);
  const endIndex = dateKeys.indexOf(clippedEnd);
  if (startIndex < 0 || endIndex < 0) return null;
  const dayCount = endIndex - startIndex + 1;
  if (dayCount === 1) {
    const slot = task.scheduleSlot || 'FULL';
    if (slot === 'AM') return { startCol: startIndex * 2, span: 1 };
    if (slot === 'PM') return { startCol: startIndex * 2 + 1, span: 1 };
    return { startCol: startIndex * 2, span: 2 };
  }
  return { startCol: startIndex * 2, span: dayCount * 2 };
}

describe('schedule layout placement', () => {
  const dateKeys = ['2026-06-01', '2026-06-02', '2026-06-03'];

  test('single-day AM slot', () => {
    const p = getTaskPlacement({ scheduleDate: '2026-06-02', scheduleSlot: 'AM' }, dateKeys);
    expect(p).toEqual({ startCol: 2, span: 1 });
  });

  test('multi-day span uses full width in slots', () => {
    const p = getTaskPlacement(
      { startDate: '2026-06-01', dueDate: '2026-06-03', scheduleSlot: 'FULL' },
      dateKeys
    );
    expect(p).toEqual({ startCol: 0, span: 6 });
  });

  test('task outside visible range returns null', () => {
    const p = getTaskPlacement({ dueDate: '2026-06-10' }, dateKeys);
    expect(p).toBeNull();
  });
});
