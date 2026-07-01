import React, { useMemo } from 'react';
import { formatProjectInr } from './ProjectAnalyticsTableBits';

const CATEGORY_LABELS = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  tax: 'Tax',
  other: 'Other',
  report: 'Report',
};

export const spendCategoryRows = (spendByCategory = {}, mode = 'total') => (
  Object.entries(spendByCategory)
    .map(([key, value]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      amount: mode === 'inRange' ? (value?.inRange || 0) : (value?.total || 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
);

export const SpendCategorySummary = ({ spendByCategory, mode = 'total', className = '' }) => {
  const rows = useMemo(() => spendCategoryRows(spendByCategory, mode), [spendByCategory, mode]);
  if (!rows.length) {
    return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>;
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      {rows.map((row) => (
        <p key={row.key} className="text-[9px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
          <span className="uppercase tracking-wide">{row.label}</span>
          {' '}
          {formatProjectInr(row.amount)}
        </p>
      ))}
    </div>
  );
};

const ProjectFinanceSpendBreakdown = ({ finance, rangeLabel = 'in range' }) => {
  const spendByCategory = finance?.spendByCategory || {};
  const totalRows = spendCategoryRows(spendByCategory, 'total');
  const rangeRows = spendCategoryRows(spendByCategory, 'inRange');

  if (!totalRows.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] opacity-60">
        No spend with amounts in finance docs for this project. Upload invoices/receipts or run Assign Finance to Projects.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
            <th className="pb-2 pr-3">Category</th>
            <th className="pb-2 pr-3 text-right">All-time</th>
            <th className="pb-2 text-right">{rangeLabel}</th>
          </tr>
        </thead>
        <tbody>
          {totalRows.map((row) => {
            const inRangeAmount = spendByCategory[row.key]?.inRange || 0;
            return (
              <tr key={row.key} className="border-b border-[var(--color-bg-border)]/50">
                <td className="py-2 pr-3 font-semibold">{row.label}</td>
                <td className="py-2 pr-3 tabular-nums text-right">{formatProjectInr(row.amount)}</td>
                <td className="py-2 tabular-nums text-right">{formatProjectInr(inRangeAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-[10px] font-bold uppercase tracking-wide">
            <td className="pt-2 pr-3">Total spend</td>
            <td className="pt-2 pr-3 tabular-nums text-right">
              {formatProjectInr(totalRows.reduce((sum, row) => sum + row.amount, 0))}
            </td>
            <td className="pt-2 tabular-nums text-right">
              {formatProjectInr(rangeRows.reduce((sum, row) => sum + row.amount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ProjectFinanceSpendBreakdown;
