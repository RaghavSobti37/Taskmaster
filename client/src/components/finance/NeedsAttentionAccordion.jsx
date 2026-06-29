import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useState } from 'react';
import { Clock, ChevronDown, Check, XCircle, Eye } from 'lucide-react';
import { Button } from '../ui';
import { formatProjectName } from '../../utils/projectUtils';

export default function NeedsAttentionAccordion({
  pendingInvoices = [],
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
}) {
  const [open, setOpen] = useState(true);

  if (!pendingInvoices.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 border-b border-amber-500/20 flex items-center gap-2 text-left hover:bg-amber-500/5 transition-colors"
        aria-expanded={open}
      >
        <Clock size={14} className="text-amber-600 shrink-0" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex-1">
          Needs Attention — Pending Approvals ({pendingInvoices.length})
        </h3>
        <ChevronDown
          size={14}
          className={`text-amber-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-amber-500/10">
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Title</th>
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Type</th>
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Project</th>
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Vendor</th>
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Submitted By</th>
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Amount</th>
                  <th className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Submitted</th>
                  <th className="px-4 py-2 w-0" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map((inv) => (
                  <tr key={inv._id} className="group border-b border-amber-500/10 last:border-0 hover:bg-amber-500/5">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{inv.title}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] capitalize">
                      {inv.metadata?.submissionType === 'reimbursement' ? 'Reimbursement' : 'Invoice'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {inv.project?.name ? formatProjectName(inv.project.name) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{inv.metadata?.vendor || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{inv.submittedBy?.name || inv.uploadedBy?.name || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] tabular-nums">
                      {inv.metadata?.amount ? `₹${Number(inv.metadata.amount).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {inv.createdAt ? formatDisplayDate(new Date(inv.createdAt)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {inv.fileUrl && (
                          <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="xs"><Eye size={14} /> View</Button>
                          </a>
                        )}
                        <Button variant="success" size="xs" disabled={isApproving} onClick={() => onApprove?.(inv._id)}>
                          <Check size={14} /> Approve
                        </Button>
                        <Button variant="danger" size="xs" disabled={isRejecting} onClick={() => onReject?.(inv)}>
                          <XCircle size={14} /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden divide-y divide-amber-500/10">
            {pendingInvoices.map((inv) => (
              <div key={inv._id} className="p-4 space-y-2">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">{inv.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {inv.project?.name ? formatProjectName(inv.project.name) : '—'}
                  {inv.metadata?.amount ? (
                    <span className="tabular-nums">{` · ₹${Number(inv.metadata.amount).toLocaleString('en-IN')}`}</span>
                  ) : ''}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {inv.fileUrl && (
                    <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="xs"><Eye size={14} /> View</Button>
                    </a>
                  )}
                  <Button variant="success" size="xs" disabled={isApproving} onClick={() => onApprove?.(inv._id)}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="danger" size="xs" disabled={isRejecting} onClick={() => onReject?.(inv)}>
                    <XCircle size={14} /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-[10px] text-[var(--color-text-muted)] border-t border-amber-500/10">
            Approved invoices appear in the document list below. Pending submissions are hidden until approved.
          </p>
        </>
      )}
    </div>
  );
}
