import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui';

/**
 * Surfaces data-quality signals before users trust KPI numbers.
 */
export default function ProjectAnalyticsDataQualityBanner({ dataQuality, onReviewMembers }) {
  if (!dataQuality) return null;

  const {
    duplicateLogsCollapsed = 0,
    excludedFinanceDocs = 0,
    unverifiedFinanceDocs = 0,
    membersHoursWithoutCompletions = 0,
  } = dataQuality;

  const items = [];
  if (duplicateLogsCollapsed > 0) {
    items.push(`${duplicateLogsCollapsed} duplicate log${duplicateLogsCollapsed === 1 ? '' : 's'} collapsed`);
  }
  if (excludedFinanceDocs > 0) {
    items.push(`${excludedFinanceDocs} unverified finance doc${excludedFinanceDocs === 1 ? '' : 's'} excluded`);
  }
  if (unverifiedFinanceDocs > 0) {
    items.push(`${unverifiedFinanceDocs} doc${unverifiedFinanceDocs === 1 ? '' : 's'} pending review`);
  }
  if (membersHoursWithoutCompletions > 0) {
    items.push(
      `${membersHoursWithoutCompletions} member${membersHoursWithoutCompletions === 1 ? '' : 's'} with task hours but 0 completions`,
    );
  }

  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        <Badge variant="warning" className="!text-[9px] uppercase">Data quality</Badge>
        <span className="text-[var(--color-text-secondary)]">{items.join(' · ')}</span>
        {membersHoursWithoutCompletions > 0 && onReviewMembers && (
          <button
            type="button"
            onClick={onReviewMembers}
            className="text-[10px] font-bold uppercase tracking-wide text-amber-300 hover:underline"
          >
            Review members
          </button>
        )}
      </div>
    </div>
  );
}
