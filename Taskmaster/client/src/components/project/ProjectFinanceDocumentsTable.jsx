import React, { useMemo } from 'react';
import { formatDisplayDate } from '../../utils/dateDisplay';
import { FinanceCategoryBadge } from '../finance/FinanceDocumentRow';
import { formatProjectInr } from './ProjectAnalyticsTableBits';
import { Badge } from '../ui';

const STATUS_LABEL = {
  verified: { label: 'Verified', variant: 'mint' },
  excluded: { label: 'Excluded', variant: 'slate' },
  unverified: { label: 'Pending', variant: 'warning' },
};

const formatAmount = (doc) => {
  const currency = (doc.currency || 'INR').toUpperCase();
  if (currency !== 'INR') {
    return `${currency} ${Number(doc.amount).toLocaleString('en-IN')}`;
  }
  return formatProjectInr(doc.amount, { emptyLabel: '—' });
};

const ProjectFinanceDocumentsTable = ({ documents = [], rangeLabel = 'In range' }) => {
  const rows = useMemo(
    () => (documents || []).filter((doc) => doc.amount > 0),
    [documents],
  );

  const rangeTotal = useMemo(
    () => rows
      .filter((doc) => doc.inRange && doc.countsTowardTotals)
      .reduce((sum, doc) => sum + (doc.baseAmountInr ?? doc.amount), 0),
    [rows],
  );

  if (!rows.length) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] opacity-60">
        No spend documents for this project. Upload invoices/receipts in Finance or run Assign Finance to Projects.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
            <th className="pb-2 pr-3 font-semibold">Document</th>
            <th className="pb-2 pr-3 font-semibold">Vendor</th>
            <th className="pb-2 pr-3 text-right font-semibold">Amount</th>
            <th className="pb-2 pr-3 font-semibold">Currency</th>
            <th className="pb-2 pr-3 font-semibold">Category</th>
            <th className="pb-2 pr-3 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((doc) => {
            const status = STATUS_LABEL[doc.analyticsStatus] || STATUS_LABEL.unverified;
            const dim = !doc.countsTowardTotals;
            return (
              <tr
                key={doc._id}
                className={`border-b border-[var(--color-bg-border)]/50 ${dim ? 'opacity-50' : ''}`}
              >
                <td className="py-2 pr-3 font-semibold truncate max-w-[180px]" title={doc.title}>
                  {doc.title}
                </td>
                <td className="py-2 pr-3 text-[var(--color-text-secondary)] uppercase text-[10px]">
                  {doc.vendor || '—'}
                </td>
                <td className="py-2 pr-3 tabular-nums text-right font-bold">
                  {formatAmount(doc)}
                </td>
                <td className="py-2 pr-3 text-[10px] uppercase text-[var(--color-text-muted)]">
                  {doc.currency || 'INR'}
                </td>
                <td className="py-2 pr-3">
                  <FinanceCategoryBadge category={doc.category} isFolder={false} />
                </td>
                <td className="py-2 pr-3">
                  <Badge variant={status.variant} className="!text-[8px] uppercase">
                    {status.label}
                  </Badge>
                </td>
                <td className="py-2 tabular-nums text-[10px] text-[var(--color-text-muted)]">
                  {doc.date ? formatDisplayDate(new Date(doc.date)) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-[10px] font-bold uppercase tracking-wide">
            <td colSpan={2} className="pt-2 pr-3">
              Verified spend ({rangeLabel.toLowerCase()}, INR base)
            </td>
            <td className="pt-2 pr-3 tabular-nums text-right">{formatProjectInr(rangeTotal)}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ProjectFinanceDocumentsTable;
