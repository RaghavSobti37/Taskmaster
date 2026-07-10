import { describe, expect, it } from 'vitest';
import { isDashboardBooting, shouldDeferWidgetRender } from './dashboardBootState';

describe('dashboardBootState', () => {
  it('boots until primary dashboard queries settle', () => {
    expect(isDashboardBooting({
      queriesEnabled: true,
      summaryLoading: true,
      tasksLoading: false,
      projectsLoading: false,
      reviewLoading: false,
    })).toBe(true);

    expect(isDashboardBooting({
      queriesEnabled: true,
      summaryLoading: false,
      tasksLoading: false,
      projectsLoading: false,
      reviewLoading: false,
    })).toBe(false);
  });

  it('defers non-analytics widgets until secondary idle gate', () => {
    expect(shouldDeferWidgetRender('system-health', {
      secondaryWidgetsReady: false,
      heavyWidgetsReady: false,
      isAnalytics: false,
    })).toBe(true);
  });

  it('defers analytics widgets until heavy idle gate', () => {
    expect(shouldDeferWidgetRender('pipeline-summary', {
      secondaryWidgetsReady: true,
      heavyWidgetsReady: false,
      isAnalytics: true,
    })).toBe(true);

    expect(shouldDeferWidgetRender('pipeline-summary', {
      secondaryWidgetsReady: true,
      heavyWidgetsReady: true,
      isAnalytics: true,
    })).toBe(false);
  });
});
