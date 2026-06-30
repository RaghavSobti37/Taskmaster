import { describe, it, expect } from 'vitest';
import {
  getWidgetGridStyle,
  filterWidgetsForMobileGrid,
  prepareDailyActionRenderList,
  repackDashboardElements,
  sortWidgetsForMobileStack,
} from './dashboardSections';

describe('dashboardSections grid layout', () => {
  it('places widgets at saved col/row with explicit grid lines', () => {
    const style = getWidgetGridStyle({ size: '2', col: 3, row: 2 }, 'daily-actions');
    expect(style).toEqual({ gridColumn: '3 / span 2', gridRow: 2 });
  });

  it('keeps review queue on the right after merging task widgets', () => {
    const packed = repackDashboardElements([
      { componentId: 'todos-today', section: 'daily-actions', order: 1, size: '2', visible: true },
      { componentId: 'schedule', section: 'daily-actions', order: 2, size: '1', visible: true },
      { componentId: 'mark-attendance', section: 'daily-actions', order: 3, size: '1', visible: true },
      { componentId: 'todos-overdue', section: 'daily-actions', order: 4, size: '2', visible: true },
      { componentId: 'review-queue', section: 'daily-actions', order: 5, size: '2', visible: true },
    ]);

    const review = packed.find((e) => e.componentId === 'review-queue');
    expect(review?.col).toBe(3);
    expect(review?.row).toBe(2);

    const merged = prepareDailyActionRenderList(packed);
    const reviewMerged = merged.find((e) => e.componentId === 'review-queue');
    expect(reviewMerged?.col).toBe(3);
    expect(getWidgetGridStyle(reviewMerged, 'daily-actions').gridColumn).toBe('3 / span 2');
  });

  it('stacks widgets full width on mobile', () => {
    expect(getWidgetGridStyle({ size: '2', col: 3, row: 2 }, 'daily-actions', { mobile: true }))
      .toEqual({ gridColumn: '1 / -1' });
  });

  it('omits mark-attendance from mobile grid when MobileAttendanceBar handles it', () => {
    const filtered = filterWidgetsForMobileGrid([
      { componentId: 'mark-attendance', order: 1 },
      { componentId: 'schedule', order: 2 },
    ]);
    expect(filtered.map((w) => w.componentId)).toEqual(['schedule']);
  });

  it('orders mobile stack with action widgets first', () => {
    const ordered = sortWidgetsForMobileStack([
      { componentId: 'review-queue', order: 5 },
      { componentId: 'mark-attendance', order: 3 },
      { componentId: 'my-tasks', order: 1 },
    ]);
    expect(ordered.map((w) => w.componentId)).toEqual([
      'mark-attendance',
      'my-tasks',
      'review-queue',
    ]);
  });
});
