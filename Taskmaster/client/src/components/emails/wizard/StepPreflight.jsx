import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronLeft, ChevronRight, ExternalLink, Save } from 'lucide-react';
import { Button, Input } from '../../ui';
import EmailDevicePreview from '../EmailDevicePreview';
import CampaignAttachmentsField from './CampaignAttachmentsField';
import { resolveRowValuesFromRecipient } from '../../../utils/indexedTemplateVariables';
import {
  inlineQuillIndentsInHtml,
  wrapVisualPreviewBody,
} from '../../../utils/visualEmailHtml';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { getAutoMailerOrigin } from '../../../utils/autoMailerUrl';

function resolveProfileSignature(profiles, senderProfileId) {
  if (!senderProfileId) return '';
  const profile = profiles.find((p) => String(p._id) === String(senderProfileId));
  return profile?.signature || '';
}

export default function StepPreflight({
  audience,
  approvedTemplates = [],
  templateBody = '',
  profiles = [],
}) {
  const { watch, setValue } = useFormContext();
  const { user } = useAuth();
  const toast = useToast();

  const [previewIndex, setPreviewIndex] = useState(0);
  const [serverPreview, setServerPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [testSending, setTestSending] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState('');

  const formValues = watch();
  const mailTemplateId = formValues.mailTemplateId;
  const selectedTemplate = approvedTemplates.find((t) => String(t._id) === String(mailTemplateId));
  const recipients = audience.previewRecipients;
  const activeRecipient = recipients[previewIndex] || recipients[0];
  const stats = useMemo(() => {
    const total = audience.previewRecipients.length;
    const valid = audience.audienceHealth.validCount;
    const invalid = total - valid;
    return { total, valid, invalid };
  }, [audience]);

  useEffect(() => {
    if (formValues.signatureSaved && formValues.signature) {
      setSignatureDraft(formValues.signature);
    }
  }, [formValues.signature, formValues.signatureSaved]);

  const handleIncludeSignatureChange = (checked) => {
    setValue('includeSignature', checked, { shouldValidate: true });
    if (!checked) return;
    if (formValues.signatureSaved && formValues.signature) {
      setSignatureDraft(formValues.signature);
      return;
    }
    const fromProfile = resolveProfileSignature(profiles, formValues.senderProfileId);
    if (fromProfile) {
      setSignatureDraft(fromProfile);
      return;
    }
    if (!signatureDraft.trim()) {
      setSignatureDraft('<div dir="ltr"><strong>Your Name</strong><br/>The Shakti Collective</div>');
    }
  };

  const handleSaveSignature = () => {
    const trimmed = signatureDraft.trim();
    if (!trimmed) {
      toast.warn('Enter a signature before saving');
      return;
    }
    setValue('signature', trimmed, { shouldValidate: true });
    setValue('signatureSaved', true, { shouldValidate: true });
    toast.success('Signature saved — preview updated');
  };

  const isRawHtml = selectedTemplate?.format === 'rawHtml';

  const clientPreviewHtml = useMemo(() => {
    if (!templateBody || !activeRecipient) return '';
    const values = resolveRowValuesFromRecipient(activeRecipient, formValues.variableMapping || {});
    let html = templateBody;
    Object.entries(values).forEach(([idx, val]) => {
      html = html.replace(new RegExp(`\\{${idx}\\}`, 'g'), val || `{${idx}}`);
    });
    if (isRawHtml) return html;
    return wrapVisualPreviewBody(inlineQuillIndentsInHtml(html), { theme: 'light' });
  }, [templateBody, activeRecipient, formValues.variableMapping, isRawHtml]);

  useEffect(() => {
    if (!templateBody || !activeRecipient) {
      setServerPreview('');
      return undefined;
    }
    setServerPreview('');
    setPreviewLoading(false);
    return undefined;
  }, [
    templateBody,
    activeRecipient,
    isRawHtml,
    formValues.subject,
    formValues.senderProfileId,
    formValues.variableMapping,
  ]);

  const previewHtml = serverPreview || clientPreviewHtml;

  const handleTestSend = async () => {
    if (!testEmail) { toast.warn('Enter test email'); return; }
    setTestSending(true);
    try {
      const opened = window.open(`${getAutoMailerOrigin()}/campaigns/new`, '_blank', 'noopener,noreferrer');
      if (opened) toast.success('Opened Auto-Mailer for campaign testing.');
      else toast.warn('Open Auto-Mailer to test this campaign.');
    } catch (e) {
      toast.error('Could not open Auto-Mailer: ' + (e.message || 'popup blocked'));
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Auto-Mailer summary</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Valid', value: stats.valid },
            { label: 'Invalid dropped', value: stats.invalid },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <p className="text-[10px] uppercase text-[var(--color-text-muted)]">{label}</p>
              <p className="text-xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          CoreKnot prepares campaign context only. Auto-Mailer owns testing, dispatch, delivery queues, and rate limits.
        </p>

        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] space-y-2 text-sm">
          <p><span className="text-[var(--color-text-muted)]">Campaign:</span> {formValues.title}</p>
          <p><span className="text-[var(--color-text-muted)]">Subject:</span> {formValues.subject}</p>
          <p><span className="text-[var(--color-text-muted)]">Template:</span> {selectedTemplate?.name || '—'}</p>
        </div>

        <div className="space-y-3 p-4 rounded-xl border border-[var(--color-bg-border)]">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={formValues.includeSignature}
              onChange={(e) => handleIncludeSignatureChange(e.target.checked)}
            />
            Include sender signature
          </label>

          {formValues.includeSignature && (
            <div className="space-y-2 pl-1 border-l-2 border-[var(--color-action-primary)]/30 ml-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                HTML signature
                {formValues.signatureSaved
                  ? <span className="ml-2 text-[var(--color-action-primary)]">Saved</span>
                  : <span className="ml-2 text-amber-500">Not saved yet</span>}
              </p>
              <textarea
                className="w-full h-28 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-mono outline-none resize-y"
                placeholder="HTML signature — shown at the bottom of every email"
                value={signatureDraft}
                onChange={(e) => {
                  setSignatureDraft(e.target.value);
                  setValue('signatureSaved', false, { shouldValidate: false });
                }}
              />
              <Button size="sm" variant="secondary" onClick={handleSaveSignature}>
                <Save size={14} /> Save signature
              </Button>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Preview updates after you save. Auto-Mailer stores the final sender signature when you continue there.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={formValues.includeUnsubscribe}
              onChange={(e) => setValue('includeUnsubscribe', e.target.checked, { shouldValidate: true })}
            />
            Include unsubscribe link
          </label>
        </div>

        <CampaignAttachmentsField />

        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] space-y-2">
          <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Campaign test</label>
          <div className="flex gap-2">
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="your@email.com" className="flex-1" />
            <Button variant="secondary" size="sm" onClick={handleTestSend} disabled={testSending}>
              {testSending ? (
                <>
                  <ExternalLink size={14} /> Opening…
                </>
              ) : (
                <>
                  <ExternalLink size={14} /> Open Auto-Mailer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Live preview</p>
          {recipients.length > 1 && (
            <div className="flex items-center gap-2">
              <Button size="xs" variant="ghost" disabled={previewIndex <= 0} onClick={() => setPreviewIndex((i) => i - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-[var(--color-text-muted)]">{previewIndex + 1} / {recipients.length}</span>
              <Button size="xs" variant="ghost" disabled={previewIndex >= recipients.length - 1} onClick={() => setPreviewIndex((i) => i + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
        {activeRecipient && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Previewing: {activeRecipient.name || activeRecipient.email}
          </p>
        )}
        {previewLoading && !serverPreview ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">Loading preview…</div>
        ) : (
          <EmailDevicePreview
            html={previewHtml}
            minHeight={420}
            subject={formValues.subject}
            fromEmail={formValues.resendFromEmail}
            toLabel={activeRecipient?.name || activeRecipient?.email || ''}
          />
        )}
      </div>
    </div>
  );
}
