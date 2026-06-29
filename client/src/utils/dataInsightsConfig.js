export const DATA_INSIGHTS_TIERS = {
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
};

export const PAGE_INSIGHTS_CONFIG = {
  '/admin/exly-campaigns': { tier: DATA_INSIGHTS_TIERS.L, panelColumns: 3, chartColumns: 2 },
  '/admin/crm-stats': { tier: DATA_INSIGHTS_TIERS.XL, panelColumns: 3, chartColumns: 2 },
  '/admin/project-analytics': { tier: DATA_INSIGHTS_TIERS.L, panelColumns: 3, chartColumns: 2 },
  '/admin': { tier: DATA_INSIGHTS_TIERS.L, panelColumns: 3, chartColumns: 2, clientRowLimit: 500 },
  '/admin/ops-hub': { tier: DATA_INSIGHTS_TIERS.L, panelColumns: 2, chartColumns: 2 },
  '/artists/portfolio': { tier: DATA_INSIGHTS_TIERS.L, panelColumns: 3, chartColumns: 2 },
  '/crm': { tier: DATA_INSIGHTS_TIERS.M, panelColumns: 2, chartColumns: 1, clientRowLimit: 100 },
  '/emails/analytics': { tier: DATA_INSIGHTS_TIERS.L, panelColumns: 2, chartColumns: 2 },
  '/attendance': { tier: DATA_INSIGHTS_TIERS.M, panelColumns: 2, chartColumns: 1 },
  '/logs': { tier: DATA_INSIGHTS_TIERS.M, panelColumns: 2, chartColumns: 1 },
  '/admin/gamification': { tier: DATA_INSIGHTS_TIERS.S, panelColumns: 1 },
};

export function getPageInsightsConfig(pathname) {
  if (!pathname) return null;
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (PAGE_INSIGHTS_CONFIG[normalized]) return PAGE_INSIGHTS_CONFIG[normalized];
  const match = Object.entries(PAGE_INSIGHTS_CONFIG).find(([key]) =>
    normalized.startsWith(key) && key !== '/',
  );
  return match ? match[1] : null;
}

export function shouldClientAggregate(rowCount, config) {
  const limit = config?.clientRowLimit ?? 100;
  return rowCount <= limit;
}
