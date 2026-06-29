const {
  rollupFinanceByProject,
  budgetStatusTone,
} = require('../../shared/projectFinanceRollup');

describe('projectFinanceRollup', () => {
  const rangeStart = new Date('2026-06-01T00:00:00');
  const rangeEnd = new Date('2026-06-30T23:59:59');
  const pid = '507f1f77bcf86cd799439011';

  test('rollupFinanceByProject splits budget, spend, and revenue', () => {
    const map = rollupFinanceByProject([
      { project: pid, category: 'budget', metadata: { amount: 100000 }, createdAt: '2026-01-01' },
      { project: pid, category: 'invoice', metadata: { amount: 30000, date: '2026-06-10' }, createdAt: '2026-06-10' },
      { project: pid, category: 'receipt', metadata: { amount: 5000, date: '2025-12-01' }, createdAt: '2025-12-01' },
      { project: pid, category: 'contract', metadata: { amount: 80000, date: '2026-06-15' }, createdAt: '2026-06-15' },
    ], rangeStart, rangeEnd);

    const row = map.get(pid);
    expect(row.budget).toBe(100000);
    expect(row.spentTotal).toBe(35000);
    expect(row.spentInRange).toBe(30000);
    expect(row.revenueTotal).toBe(80000);
    expect(row.revenueInRange).toBe(80000);
    expect(row.remaining).toBe(65000);
    expect(row.budgetUsedPct).toBe(35);
  });

  test('budgetStatusTone flags over-budget projects', () => {
    expect(budgetStatusTone(80)).toBe('warning');
    expect(budgetStatusTone(120)).toBe('danger');
    expect(budgetStatusTone(null)).toBe('neutral');
  });
});
