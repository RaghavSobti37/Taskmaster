const BUDGET_CATEGORIES = new Set(['budget']);
const EXPENSE_CATEGORIES = new Set(['invoice', 'receipt', 'tax']);
const REVENUE_CATEGORIES = new Set(['contract', 'proposal']);
const SPEND_TRACK_CATEGORIES = new Set(['invoice', 'receipt', 'tax', 'other', 'report']);

/** ponytail: static FX → INR until live rates API */
const FX_TO_INR = {
  INR: 1,
  USD: 83,
  EUR: 90,
  GBP: 105,
};

const KNOWN_CURRENCIES = new Set(Object.keys(FX_TO_INR));

const roundMoney = (n) => Math.round(n * 100) / 100;

const docAmount = (doc) => Number(doc?.metadata?.amount) || 0;

const docCurrency = (doc) => String(doc?.metadata?.currency || 'INR').trim().toUpperCase() || 'INR';

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
  hasBudget: false,
  budget: null,
  spentTotal: 0,
  spentInRange: 0,
  spentInRangeBase: 0,
  spentInRangeByCurrency: {},
  foreignSpendInRange: [],
  revenueTotal: 0,
  revenueInRange: 0,
  revenueInRangeBase: 0,
  remaining: null,
  budgetUsedPct: null,
  spendByCategory: {},
  excludedDocCount: 0,
  unverifiedDocCount: 0,
});

/** Analytics inclusion status for finance documents. */
const financeDocAnalyticsStatus = (doc) => {
  if (doc.metadata?.analyticsExcluded === true) return 'excluded';
  if (doc.metadata?.analyticsVerified === true) return 'verified';
  if (doc.metadata?.analyticsVerified === false) return 'excluded';

  const title = String(doc.title || doc.fileName || '').trim();
  const lower = title.toLowerCase();
  if (/whatsapp\s*image|screenshot|img_\d|photo_\d|scan_\d/i.test(lower)) return 'excluded';

  const vendor = String(doc.metadata?.vendor || '').trim();
  if (vendor && /[\u0000-\u001f\u007f-\u009f]/.test(vendor)) return 'excluded';
  if (vendor && vendor.replace(/[^a-zA-Z0-9\s]/g, '').length < 2 && doc.category === 'other') return 'excluded';

  if (doc.category === 'invoice' || doc.category === 'receipt' || doc.category === 'tax') {
    return doc.approvalStatus === 'rejected' ? 'excluded' : 'verified';
  }
  if (doc.category === 'budget' || doc.category === 'contract' || doc.category === 'proposal') {
    return 'verified';
  }
  if (doc.category === 'other' && !doc.referenceNumber && /image|photo|scan|whatsapp/i.test(lower)) {
    return 'excluded';
  }
  return 'unverified';
};

const convertToBaseInr = (amount, currency) => {
  const code = (currency || 'INR').toUpperCase();
  const rate = FX_TO_INR[code];
  if (!rate) return { baseAmount: null, currency: code };
  return { baseAmount: amount * rate, currency: code };
};

const ensureCategorySpend = (row, category) => {
  if (!row.spendByCategory[category]) row.spendByCategory[category] = emptyCategorySpend();
  return row.spendByCategory[category];
};

const addSpend = (row, category, amount, inRange, baseInr, currency) => {
  row.spentTotal += amount;
  if (inRange) {
    row.spentInRange += amount;
    if (baseInr != null) row.spentInRangeBase += baseInr;
    if (currency && currency !== 'INR') {
      row.spentInRangeByCurrency[currency] = roundMoney(
        (row.spentInRangeByCurrency[currency] || 0) + amount,
      );
      row.foreignSpendInRange.push({ currency, amount: roundMoney(amount) });
    }
  }
  const bucket = ensureCategorySpend(row, category);
  bucket.total += amount;
  if (inRange) bucket.inRange += amount;
};

const applyFinanceDoc = (row, doc, rangeStart, rangeEnd) => {
  const status = financeDocAnalyticsStatus(doc);
  if (status === 'excluded') {
    row.excludedDocCount += 1;
    return { status, counted: false };
  }
  if (status === 'unverified') {
    row.unverifiedDocCount += 1;
    return { status, counted: false };
  }

  const amount = docAmount(doc);
  if (amount <= 0) return { status, counted: false };

  const category = doc.category || 'other';
  const inRange = inDateRange(doc, rangeStart, rangeEnd);
  const currency = docCurrency(doc);
  const { baseAmount } = convertToBaseInr(amount, currency);

  if (BUDGET_CATEGORIES.has(category)) {
    row.hasBudget = true;
    row.budget = roundMoney((row.budget || 0) + amount);
    return { status, counted: true };
  }
  if (REVENUE_CATEGORIES.has(category)) {
    row.revenueTotal += amount;
    if (inRange) {
      row.revenueInRange += amount;
      if (baseAmount != null) row.revenueInRangeBase += baseAmount;
    }
    return { status, counted: true };
  }
  if (SPEND_TRACK_CATEGORIES.has(category)) {
    addSpend(row, category, amount, inRange, baseAmount, currency);
    return { status, counted: true };
  }
  return { status, counted: false };
};

const finalizeFinanceRow = (row) => {
  if (!row.hasBudget) {
    row.budget = null;
    row.remaining = null;
    row.budgetUsedPct = null;
  } else {
    row.budget = roundMoney(row.budget);
    row.remaining = roundMoney(Math.max(0, row.budget - row.spentTotal));
    row.budgetUsedPct = row.budget > 0
      ? roundMoney((row.spentTotal / row.budget) * 100)
      : null;
  }

  row.spentTotal = roundMoney(row.spentTotal);
  row.spentInRange = roundMoney(row.spentInRange);
  row.spentInRangeBase = roundMoney(row.spentInRangeBase);
  row.revenueTotal = roundMoney(row.revenueTotal);
  row.revenueInRange = roundMoney(row.revenueInRange);
  row.revenueInRangeBase = roundMoney(row.revenueInRangeBase);

  Object.keys(row.spendByCategory).forEach((key) => {
    row.spendByCategory[key] = {
      total: roundMoney(row.spendByCategory[key].total),
      inRange: roundMoney(row.spendByCategory[key].inRange),
    };
  });

  row.foreignSpendInRange = row.foreignSpendInRange.filter(
    (e, i, arr) => arr.findIndex((x) => x.currency === e.currency) === i,
  );

  return row;
};

/** Roll up finance docs into per-project totals (verified docs only in spend/revenue). */
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

const mapFinanceDocForAnalytics = (doc, rangeStart, rangeEnd) => {
  const status = financeDocAnalyticsStatus(doc);
  const currency = docCurrency(doc);
  const amount = docAmount(doc);
  const { baseAmount } = convertToBaseInr(amount, currency);
  return {
    _id: doc._id,
    title: doc.title || 'Untitled',
    referenceNumber: doc.referenceNumber || '',
    category: doc.category,
    amount,
    currency,
    baseAmountInr: baseAmount,
    vendor: doc.metadata?.vendor || '',
    date: doc.metadata?.date || doc.createdAt,
    inRange: inDateRange(doc, rangeStart, rangeEnd),
    analyticsStatus: status,
    countsTowardTotals: status === 'verified',
  };
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
  FX_TO_INR,
  KNOWN_CURRENCIES,
  rollupFinanceByProject,
  financeDocAnalyticsStatus,
  mapFinanceDocForAnalytics,
  budgetStatusTone,
  roundMoney,
  docAmount,
  docCurrency,
  docEffectiveDate,
  inDateRange,
  convertToBaseInr,
};
