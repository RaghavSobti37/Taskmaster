/**
 * Tiered dashboard layout (v2): sections, widget placement, routes, defaults.
 */
import {
  COMPONENT_REGISTRY,
  getAccessibleComponents,
  canAccessComponent,
} from './componentRegistry';

export const DASHBOARD_LAYOUT_VERSION = 2;

export const DASHBOARD_SECTIONS = [
  {
    id: 'status-strip',
    title: 'Status strip',
    collapsedLabel: 'System health, last backup, and alerts',
    collapsible: true,
    defaultCollapsed: true,
  },
  {
    id: 'daily-actions',
    title: 'Daily actions',
    sectionLabel: null,
    collapsible: false,
    defaultCollapsed: false,
  },
  {
    id: 'team-context',
    title: 'Team & work context',
    sectionLabel: 'TEAM AND WORK CONTEXT',
    collapsible: false,
    defaultCollapsed: false,
  },
  {
    id: 'analytics',
    title: 'Analytics & reporting',
    sectionLabel: 'ANALYTICS AND REPORTING',
    collapsedLabel: 'CRM, campaigns, department stats, and more',
    collapsible: true,
    defaultCollapsed: true,
  },
  {
    id: 'more',
    title: 'More widgets',
    collapsedLabel: 'Notes, pin board, missions, leave requests, reimbursements',
    collapsible: true,
    defaultCollapsed: true,
  },
];

/** Default section for each widget */
export const WIDGET_SECTION_MAP = {
  'system-health': 'status-strip',
  'last-backup': 'status-strip',
  'render-logs': 'status-strip',
  'render-logs-production': 'status-strip',
  'render-logs-staging-api': 'status-strip',
  'render-logs-staging-nest': 'status-strip',
  'leave-alerts': 'status-strip',
  'invoice-alerts': 'status-strip',
  'attendance-overview': 'status-strip',
  'mark-attendance': 'daily-actions',
  schedule: 'daily-actions',
  'todos-today': 'daily-actions',
  'todos-overdue': 'daily-actions',
  'review-queue': 'daily-actions',
  'booked-calls': 'daily-actions',
  'followups-today': 'daily-actions',
  'artist-calendar': 'daily-actions',
  leaderboard: 'team-context',
  'projects-today': 'team-context',
  announcements: 'team-context',
  pinboard: 'team-context',
  'pipeline-summary': 'analytics',
  'campaign-metrics': 'analytics',
  'dept-stats': 'analytics',
  'team-activity': 'analytics',
  notes: 'more',
  composer: 'more',
  'daily-missions': 'more',
};

/** Navigate on card header / body click */
export const WIDGET_ROUTES = {
  'mark-attendance': '/attendance',
  schedule: '/schedule',
  'todos-today': '/todo',
  'todos-overdue': '/todo?filter=overdue',
  'my-tasks': '/todo',
  'review-queue': '/projects',
  leaderboard: '/settings?tab=progress',
  'projects-today': '/projects',
  announcements: '/management?tab=announcements',
  notes: '/notes',
  pinboard: '/dashboard',
  composer: '/dashboard',
  'daily-missions': '/dashboard',
  'pipeline-summary': '/crm',
  'campaign-metrics': '/emails',
  'dept-stats': '/admin/users',
  'team-activity': '/projects',
  'system-health': '/admin/console',
  'last-backup': '/admin/console',
  'render-logs': '/admin/console',
  'leave-alerts': '/settings?tab=leave',
  'invoice-alerts': '/settings?tab=invoice',
  'attendance-overview': '/attendance/all',
  'booked-calls': '/crm',
  'followups-today': '/crm?tab=followups',
  'artist-calendar': '/schedule',
};

export const DAILY_ACTION_ORDER = [
  'mark-attendance',
  'schedule',
  'my-tasks',
  'review-queue',
];

export const TEAM_CONTEXT_ORDER = ['leaderboard', 'projects-today', 'announcements'];

const DEFAULT_VISIBLE = new Set([
  'mark-attendance',
  'schedule',
  'todos-today',
  'todos-overdue',
  'review-queue',
  'leaderboard',
  'projects-today',
  'announcements',
  'system-health',
  'last-backup',
  'render-logs',
  'pipeline-summary',
  'campaign-metrics',
  'dept-stats',
  'team-activity',
]);

const DEFAULT_HIDDEN = new Set([
  'notes',
  'pinboard',
  'composer',
  'daily-missions',
  'leave-alerts',
  'invoice-alerts',
  'render-logs-production',
  'render-logs-staging-api',
  'render-logs-staging-nest',
]);

export const DEFAULT_SECTION_STATE = Object.fromEntries(
  DASHBOARD_SECTIONS.filter((s) => s.collapsible).map((s) => [s.id, s.defaultCollapsed])
);

export function getWidgetSection(componentId) {
  return WIDGET_SECTION_MAP[componentId] || 'more';
}

export function getWidgetRoute(componentId) {
  return WIDGET_ROUTES[componentId] || null;
}

export function getWidgetLabel(componentId) {
  if (componentId === 'my-tasks') return 'My tasks';
  return COMPONENT_REGISTRY[componentId]?.label || componentId;
}

/** Build default v2 element list for a permission preset */
export function getDefaultTierElements(permissionPreset) {
  const accessible = getAccessibleComponents(permissionPreset);
  let order = 0;
  const elements = [];

  for (const section of DASHBOARD_SECTIONS) {
    const sectionWidgets = accessible.filter((id) => getWidgetSection(id) === section.id);
    sectionWidgets.forEach((componentId) => {
      order += 1;
      const visible = DEFAULT_VISIBLE.has(componentId)
        && !DEFAULT_HIDDEN.has(componentId);
      elements.push({
        componentId,
        section: section.id,
        order,
        visible,
        size: COMPONENT_REGISTRY[componentId]?.defaultSize || '1',
        col: 1,
        row: order,
      });
    });
  }

  return elements;
}

/** Merge saved preset with section metadata; migrate legacy grid presets */
export function normalizeDashboardElements(elements, permissionPreset) {
  const accessible = getAccessibleComponents(permissionPreset);
  const source = Array.isArray(elements) && elements.length
    ? elements
    : getDefaultTierElements(permissionPreset);

  const byId = new Map();
  source.forEach((el, idx) => {
    if (!accessible.includes(el.componentId)) return;
    byId.set(el.componentId, {
      ...el,
      section: el.section || getWidgetSection(el.componentId),
      order: el.order ?? idx + 1,
      visible: el.visible !== false,
    });
  });

  getDefaultTierElements(permissionPreset).forEach((def) => {
    if (!byId.has(def.componentId)) {
      byId.set(def.componentId, { ...def, visible: false });
    }
  });

  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function groupElementsBySection(elements, permissionPreset) {
  const normalized = normalizeDashboardElements(elements, permissionPreset);
  const groups = Object.fromEntries(DASHBOARD_SECTIONS.map((s) => [s.id, []]));

  normalized.forEach((el) => {
    if (!el.visible || !canAccessComponent(el.componentId, permissionPreset)) return;
    const section = el.section || getWidgetSection(el.componentId);
    if (groups[section]) groups[section].push(el);
  });

  Object.keys(groups).forEach((sectionId) => {
    groups[sectionId] = sortSectionWidgets(groups[sectionId]);
  });

  return groups;
}

export function resolveSectionState(presetSectionState) {
  return {
    ...DEFAULT_SECTION_STATE,
    ...(presetSectionState || {}),
  };
}

export function sectionMaxCols(sectionId) {
  if (sectionId === 'more') return 3;
  return 4;
}

export function sortSectionWidgets(widgets) {
  return [...widgets].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.row - b.row) || (a.col - b.col)
  );
}

export function getWidgetGridStyle(el, sectionId) {
  const maxCols = sectionMaxCols(sectionId);
  const size = Math.min(Math.max(parseInt(el.size, 10) || 1, 1), maxCols);
  const col = Math.min(
    Math.max(parseInt(el.col, 10) || 1, 1),
    Math.max(1, maxCols - size + 1)
  );
  const row = Math.max(parseInt(el.row, 10) || 1, 1);

  return {
    gridColumn: `${col} / span ${size}`,
    gridRow: row,
  };
}

export function getSectionGridStyle(sectionId) {
  const cols = sectionMaxCols(sectionId);
  const minRow = sectionId === 'status-strip' ? 120 : sectionId === 'analytics' ? 140 : 150;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: `minmax(${minRow}px, auto)`,
    gridAutoFlow: 'row dense',
  };
}

export function getWidgetMinHeightClass(sectionId) {
  if (sectionId === 'status-strip') return 'min-h-[120px]';
  if (sectionId === 'analytics') return 'min-h-[140px]';
  if (sectionId === 'team-context') return 'min-h-[200px]';
  return 'min-h-[160px]';
}

export function getElementSection(el) {
  return el.section || getWidgetSection(el.componentId);
}

/** Pack widgets inside one section grid (respects size / order). */
export function packSectionElements(sectionElements, maxCols) {
  const visibleEls = sectionElements.filter((e) => e.visible !== false);
  const hiddenEls = sectionElements.filter((e) => e.visible === false);

  const reqPos = sortSectionWidgets(visibleEls);

  const grid = [];
  const isOccupied = (r, c, size) => {
    for (let i = 0; i < size; i++) {
      if (grid[r] && grid[r][c + i]) return true;
    }
    return false;
  };
  const markOccupied = (r, c, size) => {
    if (!grid[r]) grid[r] = [];
    for (let i = 0; i < size; i++) grid[r][c + i] = true;
  };

  const placed = [];
  for (const el of reqPos) {
    const sizeNum = Math.min(Math.max(parseInt(el.size, 10) || 1, 1), maxCols);
    let placedRow = 1;
    let placedCol = 1;
    let found = false;

    for (let r = 1; r < 100; r++) {
      for (let c = 1; c <= maxCols - sizeNum + 1; c++) {
        if (!isOccupied(r, c, sizeNum)) {
          placedRow = r;
          placedCol = c;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    markOccupied(placedRow, placedCol, sizeNum);
    placed.push({ ...el, row: placedRow, col: placedCol, size: String(sizeNum) });
  }

  return [...placed, ...hiddenEls];
}

/** Recompute col/row for every visible section from order + size. */
export function repackDashboardElements(elements) {
  const hidden = elements.filter((e) => e.visible === false);
  const packed = [];

  for (const section of DASHBOARD_SECTIONS) {
    const sectionEls = elements.filter(
      (e) => e.visible !== false && getElementSection(e) === section.id
    );
    if (sectionEls.length) {
      packed.push(...packSectionElements(sectionEls, sectionMaxCols(section.id)));
    }
  }

  const packedIds = new Set(packed.map((e) => e.componentId));
  elements
    .filter((e) => e.visible !== false && !packedIds.has(e.componentId))
    .forEach((e) => packed.push(e));

  return [...packed, ...hidden];
}

const TASK_WIDGET_IDS = new Set(['todos-today', 'todos-overdue']);

/** Daily row: collapse today + overdue into my-tasks while keeping saved widths/order */
export function prepareDailyActionRenderList(sectionElements) {
  const sorted = sortSectionWidgets(sectionElements);
  const ids = new Set(sectionElements.map((e) => e.componentId));
  const hasTasks = ids.has('todos-today') || ids.has('todos-overdue');
  const today = sorted.find((e) => e.componentId === 'todos-today');
  const overdue = sorted.find((e) => e.componentId === 'todos-overdue');
  const result = [];
  let tasksMerged = false;

  for (const el of sorted) {
    if (TASK_WIDGET_IDS.has(el.componentId)) {
      if (!tasksMerged && hasTasks) {
        tasksMerged = true;
        result.push({
          componentId: 'my-tasks',
          section: 'daily-actions',
          order: Math.min(today?.order ?? overdue?.order ?? 0, overdue?.order ?? today?.order ?? 0),
          row: Math.min(today?.row ?? overdue?.row ?? 1, overdue?.row ?? today?.row ?? 1),
          col: today?.col ?? overdue?.col ?? 1,
          size: today?.size || overdue?.size || '2',
          visible: true,
        });
      }
      continue;
    }
    result.push(el);
  }

  return sortSectionWidgets(result);
}

/** Daily row: merge today + overdue into one slot; order follows saved grid order */
export function resolveDailyActionSlots(sectionElements) {
  const sorted = [...sectionElements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ids = new Set(sectionElements.map((e) => e.componentId));
  const slots = [];
  let myTasksAdded = false;

  for (const el of sorted) {
    const id = el.componentId;
    if (id === 'todos-today' || id === 'todos-overdue') {
      if (!myTasksAdded && (ids.has('todos-today') || ids.has('todos-overdue'))) {
        myTasksAdded = true;
        slots.push({
          type: 'my-tasks',
          componentIds: ['todos-today', 'todos-overdue'].filter((cid) => ids.has(cid)),
        });
      }
      continue;
    }
    if (
      id === 'mark-attendance'
      || id === 'schedule'
      || id === 'review-queue'
      || id === 'booked-calls'
      || id === 'followups-today'
      || id === 'artist-calendar'
    ) {
      slots.push({ type: 'widget', componentId: id });
    }
  }

  return slots;
}
