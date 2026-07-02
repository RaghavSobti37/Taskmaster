/** True while dashboard should show branded boot — not widget skeleton grids. */
export function isDashboardBooting({
  queriesEnabled,
  summaryLoading,
  tasksLoading,
  projectsLoading,
  reviewLoading,
}) {
  if (!queriesEnabled) return false;
  return summaryLoading || tasksLoading || projectsLoading || reviewLoading;
}

/** Widgets that must not flash skeleton placeholders during deferred mount. */
export function shouldDeferWidgetRender(componentId, { secondaryWidgetsReady, heavyWidgetsReady, isAnalytics }) {
  if (!secondaryWidgetsReady) return true;
  if (isAnalytics && !heavyWidgetsReady) return true;
  return false;
}
