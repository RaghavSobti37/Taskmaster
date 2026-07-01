const BUDGET_CATEGORIES = new Set(['budget']);
const EXPENSE_CATEGORIES = new Set(['invoice', 'receipt', 'tax']);
const REVENUE_CATEGORIES = new Set(['contract', 'proposal']);
const SPEND_TRACK_CATEGORIES = new Set(['invoice', 'receipt', 'tax', 'other', 'report']);

const roundMoney = (n) => Math.round(n * 100) / 100;

const docAmount = (doc) => Number(doc?.metadata?.amount) || 0;

const docEffectiveDate = (doc) => {
  const raw = doc?.metadata?.date || doc?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const inDateRange = (doc, rangeStart, rangeEnd) => {
  if (!rangeStart || !rangeEnd) return true;
  const d = docEffectiveDate(doc);
  if (!d) return false;
  return d >= rangeStart && d <= rangeEnd;
};

const emptyCategorySpend = () => ({ total: 0, inRange: 0 });

const emptyFinanceRow = () => ({
  budget: 0,
  spentTotal: 0,
  spentInRange: 0,
  revenueTotal: 0,
  revenueInRange: 0,
  remaining: 0,
  budgetUsedPct: null,
  spendByCategory: {},
});

const ensureCategorySpend = (row, category) => {
  if (!row.spendByCategory[category]) {
    row.spendByCategory[category] = emptyCategorySpend();
  }
  return row.spendByCategory[category];
};

const addSpend = (row, category, amount, inRange) => {
  row.spentTotal += amount;
  if (inRange) row.spentInRange += amount;
  const bucket = ensureCategorySpend(row, category);
  bucket.total += amount;
  if (inRange) bucket.inRange += amount;
};

const applyFinanceDoc = (row, doc, rangeStart, rangeEnd) => {
  const amount = docAmount(doc);
  if (amount <= 0) return;
  const category = doc.category || 'other';
  const inRange = inDateRange(doc, rangeStart, rangeEnd);

  if (BUDGET_CATEGORIES.has(category)) {
    row.budget += amount;
    return;
  }
  if (REVENUE_CATEGORIES.has(category)) {
    row.revenueTotal += amount;
    if (inRange) row.revenueInRange += amount;
    return;
  }
  if (SPEND_TRACK_CATEGORIES.has(category)) {
    addSpend(row, category, amount, inRange);
  }
};

const finalizeFinanceRow = (row) => {
  row.budget = roundMoney(row.budget);
  row.spentTotal = roundMoney(row.spentTotal);
  row.spentInRange = roundMoney(row.spentInRange);
  row.revenueTotal = roundMoney(row.revenueTotal);
  row.revenueInRange = roundMoney(row.revenueInRange);
  row.remaining = row.budget > 0 ? roundMoney(Math.max(0, row.budget - row.spentTotal)) : 0;
  row.budgetUsedPct = row.budget > 0
    ? roundMoney((row.spentTotal / row.budget) * 100)
    : null;

  Object.keys(row.spendByCategory).forEach((key) => {
    row.spendByCategory[key] = {
      total: roundMoney(row.spendByCategory[key].total),
      inRange: roundMoney(row.spendByCategory[key].inRange),
    };
  });

  return row;
};

/** Roll up finance docs into per-project totals. */
const rollupFinanceByProject = (docs = [], rangeStart = null, rangeEnd = null) => {
  const byProject = new Map();
  docs.forEach((doc) => {
    if (doc.isFolder) return;
    const pid = doc.project?.toString?.() || doc.project;
    if (!pid) return;
    if (!byProject.has(pid)) byProject.set(pid, emptyFinanceRow());
    applyFinanceDoc(byProject.get(pid), doc, rangeStart, rangeEnd);
  });
  byProject.forEach((row) => finalizeFinanceRow(row));
  return byProject;
};

const budgetStatusTone = (pct) => {
  if (pct == null) return 'neutral';
  if (pct >= 100) return 'danger';
  if (pct >= 75) return 'warning';
  return 'ok';
};

module.exports = {
  BUDGET_CATEGORIES,
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
  SPEND_TRACK_CATEGORIES,
  rollupFinanceByProject,
  budgetStatusTone,
  roundMoney,
};
