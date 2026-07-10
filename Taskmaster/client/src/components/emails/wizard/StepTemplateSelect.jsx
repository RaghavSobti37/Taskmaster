import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFormContext } from 'react-hook-form';
import { FileCode, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../../ui';
import EmailDevicePreview from '../EmailDevicePreview';
import { useMailTemplatePreview } from '../../../hooks/useMailTemplatePreview';

export default function StepTemplateSelect({
  approvedTemplates = [],
  onRefreshTemplates,
  templatesRefreshing = false,
  onContinue,
}) {
  const { watch, setValue } = useFormContext();
  const mailTemplateId = watch('mailTemplateId');
  const subject = watch('subject');

  const selected = useMemo(
    () => approvedTemplates.find((t) => String(t._id) === String(mailTemplateId)),
    [approvedTemplates, mailTemplateId]
  );

  const { html: previewHtml, subject: previewSubject, loading } = useMailTemplatePreview(selected);

  const handleSelect = (t) => {
    setValue('mailTemplateId', t._id, { shouldValidate: true });
    if (!subject && t.subject) setValue('subject', t.subject);
    setValue('variableMapping', {}, { shouldValidate: false });
  };

  if (approvedTemplates.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-dashed border-[var(--color-bg-border)] space-y-4">
        <FileCode size={40} className="mx-auto opacity-30" />
        <div>
          <p className="text-sm font-bold mb-1">No approved templates yet</p>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
            Create a template under Emails → Templates, submit it for approval, then refresh here once it is approved.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/emails/templates"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-action-primary)]/40 transition-colors"
          >
            <Plus size={14} /> Create template
          </Link>
          {onRefreshTemplates && (
            <Button size="sm" variant="ghost" onClick={onRefreshTemplates} disabled={templatesRefreshing}>
              <RefreshCw size={14} className={templatesRefreshing ? 'animate-spin' : ''} />
              {templatesRefreshing ? 'Refreshing…' : 'Refresh list'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in items-start">
      {/* Preview — left on desktop */}
      <div className="space-y-2 lg:sticky lg:top-4 order-2 lg:order-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Email preview</p>
          {loading && <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse">Updating…</span>}
        </div>
        <EmailDevicePreview
          html={previewHtml || (selected ? '<p style="padding:16px;font-family:sans-serif;color:#64748b">Loading preview…</p>' : '')}
          minHeight={400}
          subject={previewSubject || subject}
        />
        {previewSubject && previewSubject !== subject && (
          <p className="text-xs text-[var(--color-text-muted)]">Subject with variables: {previewSubject}</p>
        )}
      </div>

      {/* Template list + continue — right on desktop */}
      <div className="flex flex-col order-1 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Choose an approved template
          </p>
          {onRefreshTemplates && (
            <Button size="xs" variant="ghost" onClick={onRefreshTemplates} disabled={templatesRefreshing}>
              <RefreshCw size={12} className={templatesRefreshing ? 'animate-spin' : ''} />
              {templatesRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {approvedTemplates.map((t) => {
            const active = String(t._id) === String(mailTemplateId);
            return (
              <button
                key={t._id}
                type="button"
                onClick={() => handleSelect(t)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 ring-1 ring-[var(--color-action-primary)]/30'
                    : 'border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/40'
                }`}
              >
                <p className="font-semibold text-sm truncate">{t.name}</p>
                {t.subject && <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">{t.subject}</p>}
                <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide ${
                  active ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'
                }`}>
                  {active ? '✓ Selected' : 'Click to select'}
                </span>
              </button>
            );
          })}
        </div>
        {onContinue && (
          <div className="mt-4 pt-4 border-t border-[var(--color-bg-border)]">
            <Button variant="primary" onClick={onContinue} disabled={!mailTemplateId}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
