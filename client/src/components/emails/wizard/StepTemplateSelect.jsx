import React, { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FileCode } from 'lucide-react';
import PreviewIframe from '../PreviewIframe';
import { useMailTemplatePreview } from '../../../hooks/useMailTemplatePreview';

export default function StepTemplateSelect({ approvedTemplates = [] }) {
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
      <div className="p-12 text-center rounded-xl border border-dashed border-[var(--color-bg-border)]">
        <FileCode size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-bold mb-1">No approved templates</p>
        <p className="text-xs text-[var(--color-text-muted)]">Create and approve a template under Emails → Templates.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Approved templates</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
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
                <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-wider text-[var(--color-action-primary)]">
                  {active ? 'Selected' : 'Select'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2 lg:sticky lg:top-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Preview</p>
          {loading && <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse">Updating…</span>}
        </div>
        <PreviewIframe
          html={previewHtml || (selected ? '<p style="padding:16px;font-family:sans-serif;color:#64748b">Loading preview…</p>' : '')}
          minHeight={400}
        />
        {previewSubject && (
          <p className="text-xs text-[var(--color-text-muted)]">Subject: {previewSubject}</p>
        )}
      </div>
    </div>
  );
}
