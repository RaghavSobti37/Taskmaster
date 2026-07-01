import { describe, it, expect } from 'vitest';
import {
  getWidgetGridStyle,
  getWidgetMinHeightClass,
  filterWidgetsForMobileGrid,
  prepareDailyActionRenderList,
  repackDashboardElements,
  sortWidgetsForMobileStack,
  normalizeDashboardElements,
} from './dashboardSections';

describe('dashboardSections grid layout', () => {
  it('places widgets at saved col/row with explicit grid lines', () => {
    const style = getWidgetGridStyle({ size: '2', col: 3, row: 2 }, 'daily-actions');
    expect(style).toEqual({ gridColumn: '3 / span 2', gridRow: 2 });
  });

  it('renders today and overdue as separate daily widgets', () => {
    const packed = repackDashboardElements([
      { componentId: 'todos-today', section: 'daily-actions', order: 1, size: '1', visible: true },
      { componentId: 'schedule', section: 'daily-actions', order: 2, size: '1', visible: true },
      { componentId: 'mark-attendance', section: 'daily-actions', order: 3, size: '1', visible: true },
      { componentId: 'todos-overdue', section: 'daily-actions', order: 4, size: '1', visible: true },
      { componentId: 'review-queue', section: 'daily-actions', order: 5, size: '2', visible: true },
    ]);

    const daily = prepareDailyActionRenderList(packed);
    expect(daily.some((e) => e.componentId === 'todos-overdue')).toBe(true);
    expect(daily.some((e) => e.componentId === 'todos-today')).toBe(true);
    expect(daily.some((e) => e.componentId === 'my-tasks')).toBe(false);

    const review = daily.find((e) => e.componentId === 'review-queue');
    expect(review).toBeTruthy();
    expect(getWidgetGridStyle(review, 'daily-actions').gridColumn).toMatch(/span 2/);
  });

  it('stacks widgets full width on mobile', () => {
    expect(getWidgetGridStyle({ size: '2', col: 3, row: 2 }, 'daily-actions', { mobile: true }))
      .toEqual({ gridColumn: '1 / -1' });
  });

  it('uses natural height for mobile widget cells', () => {
    expect(getWidgetMinHeightClass('daily-actions', { mobile: true })).toBe('h-auto');
    expect(getWidgetMinHeightClass('daily-actions')).toContain('lg:min-h-');
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
      { componentId: 'todos-overdue', order: 1 },
    ]);
    expect(ordered.map((w) => w.componentId)).toEqual([
      'mark-attendance',
      'todos-overdue',
      'review-queue',
    ]);
  });

  it('drops legacy per-env render log widgets and promotes render-logs', () => {
    const normalized = normalizeDashboardElements(
      [
        { componentId: 'render-logs-production', visible: true, order: 1 },
        { componentId: 'render-logs-staging-api', visible: true, order: 2 },
        { componentId: 'render-logs', visible: false, order: 3 },
      ],
      'admin',
    );
    const ids = normalized.map((e) => e.componentId);
    expect(ids).not.toContain('render-logs-production');
    expect(ids).not.toContain('render-logs-staging-api');
    expect(normalized.find((e) => e.componentId === 'render-logs')?.visible).toBe(true);
  });
});
