import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Save, Send, Upload } from 'lucide-react';
import axios from 'axios';
import { Button, Input } from '../../ui';
import PreviewIframe from '../PreviewIframe';
import { resolveRowValuesFromRecipient } from '../../../utils/indexedTemplateVariables';
import {
  enhancePreviewDocument,
  inlineQuillIndentsInHtml,
  wrapVisualPreviewBody,
} from '../../../utils/visualEmailHtml';
import { useAuth } from '../../../contexts/AuthContext';
import { useUploadCampaignAttachment } from '../../../hooks/useTaskmasterQueries';
import { useToast } from '../../../contexts/ToastContext';

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
  const uploadMutation = useUploadCampaignAttachment();

  const [previewIndex, setPreviewIndex] = useState(0);
  const [serverPreview, setServerPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [signatureDraft, setSignatureDraft] = useState('');

  const formValues = watch();
  const mailTemplateId = formValues.mailTemplateId;
  const selectedTemplate = approvedTemplates.find((t) => String(t._id) === String(mailTemplateId));
  const recipients = audience.previewRecipients;
  const activeRecipient = recipients[previewIndex] || recipients[0];
  const attachments = formValues.attachments || [];

  const previewSignature = formValues.includeSignature && formValues.signatureSaved
    ? (formValues.signature || '').trim()
    : '';

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
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const { data } = await axios.post('/api/mail/preview', {
          content: templateBody,
          subject: formValues.subject,
          format: selectedTemplate?.format === 'rawHtml' ? 'rawHtml' : 'visual',
          includeSignature: formValues.includeSignature === true,
          signature: previewSignature,
          removeUnsubscribe: !formValues.includeUnsubscribe,
          senderProfileId: formValues.senderProfileId || formValues.senderProfileIds?.[0],
          sampleRecipient: activeRecipient,
          variableMapping: formValues.variableMapping,
          theme: 'light',
        });
        if (!cancelled) {
          const html = data.html || '';
          setServerPreview(
            isRawHtml ? html : enhancePreviewDocument(html, { theme: 'light' })
          );
        }
      } catch {
        if (!cancelled) setServerPreview('');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [
    templateBody,
    activeRecipient,
    isRawHtml,
    formValues.subject,
    formValues.includeSignature,
    formValues.includeUnsubscribe,
    previewSignature,
    formValues.senderProfileId,
    formValues.variableMapping,
  ]);

  const previewHtml = serverPreview || clientPreviewHtml;

  const handleAttachment = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const uploaded = await uploadMutation.mutateAsync(file);
        setValue('attachments', [...attachments, uploaded]);
      } catch (err) {
        toast.error(`Upload failed: ${err.response?.data?.error || err.message}`);
      }
    }
    e.target.value = '';
  };

  const handleTestSend = async () => {
    if (!testEmail) { toast.warn('Enter test email'); return; }
    if (formValues.includeSignature && !previewSignature) {
      toast.warn('Save sender signature before sending a test');
      return;
    }
    try {
      await axios.post('/api/mail/test-campaign', {
        subject: formValues.subject,
        content: templateBody,
        testEmail,
        senderProfileId: formValues.senderProfileId || formValues.senderProfileIds?.[0],
        senderProfileIds: formValues.senderMode === 'pool' ? formValues.senderProfileIds : [],
        senderMode: formValues.senderMode,
        resendFromEmail: formValues.resendFromEmail,
        format: selectedTemplate?.format === 'rawHtml' ? 'rawHtml' : 'visual',
        includeSignature: formValues.includeSignature,
        signature: previewSignature,
        removeUnsubscribe: !formValues.includeUnsubscribe,
        variableMapping: formValues.variableMapping,
        sampleRecipient: activeRecipient,
        attachments,
      });
      toast.success(`Test sent to ${testEmail}`);
    } catch (e) {
      toast.error('Test send failed: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Send summary</h4>
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
                Preview updates after you save. Signature is stored with the campaign when you save draft or dispatch.
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

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Attachments</label>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-bg-border)] text-xs font-medium hover:border-[var(--color-action-primary)]">
            <Upload size={14} /> Add file
            <input type="file" multiple className="hidden" onChange={handleAttachment} />
          </label>
          {attachments.length > 0 && (
            <ul className="text-xs space-y-1">
              {attachments.map((a, i) => (
                <li key={i}>{a.filename}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] space-y-2">
          <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Test send</label>
          <div className="flex gap-2">
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="your@email.com" className="flex-1" />
            <Button variant="secondary" size="sm" onClick={handleTestSend}>
              <Send size={14} /> Send test
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
          <PreviewIframe html={previewHtml} minHeight={420} />
        )}
      </div>
    </div>
  );
}
