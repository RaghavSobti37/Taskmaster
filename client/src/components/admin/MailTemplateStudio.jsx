import React, { useState, useMemo, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../../utils/mailTemplateQuillSetup';
import { FileCode, Plus, Save, Send, Check, X, Trash2, Eye, AlertCircle } from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui';
import { format } from 'date-fns';
import {
  useMailTemplates,
  usePendingMailTemplates,
  useSaveMailTemplate,
  useSubmitMailTemplate,
  useApproveMailTemplate,
  useRejectMailTemplate,
  useDeleteMailTemplate,
} from '../../hooks/useTaskmasterQueries';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/confirmContext';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { canApproveMailTemplates } from '../../utils/mailTemplateApprovers';
import {
  parseIndexedVariablesFromHtml,
  applyDummyValuesPlain,
  nextVariableIndex,
  insertIndexedVariable,
  getEffectiveTemplateContent,
} from '../../utils/indexedTemplateVariables';
import axios from 'axios';
import { cloneSnapshot } from '../../hooks/useUnsavedChanges';
import PreviewIframe from '../emails/PreviewIframe';
import {
  inlineQuillIndentsInHtml,
  wrapVisualPreviewBody,
  enhancePreviewDocument,
} from '../../utils/visualEmailHtml';
const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const emptyDraft = () => ({
  id: null,
  name: '',
  subject: '',
  content: '',
  format: 'visual',
  dummyValues: {},
});

const MAIL_TEMPLATE_QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    ['link'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['clean'],
  ],
  clipboard: { matchVisual: false },
};

const MAIL_TEMPLATE_QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'link', 'list', 'bullet', 'indent',
];

export default function MailTemplateStudio({ onUseInCampaign }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const canApprove = canApproveMailTemplates(user);

  const { data: allTemplates = [], refetch: refetchAll } = useMailTemplates();
  const { data: pendingTemplates = [], refetch: refetchPending } = usePendingMailTemplates(canApprove);
  const saveMutation = useSaveMailTemplate();
  const submitMutation = useSubmitMailTemplate();
  const approveMutation = useApproveMailTemplate();
  const rejectMutation = useRejectMailTemplate();
  const deleteMutation = useDeleteMailTemplate();

  const [draft, setDraft] = useState(emptyDraft());
  const [draftBaseline, setDraftBaseline] = useState(() => cloneSnapshot(emptyDraft()));
  const [useRawHtml, setUseRawHtml] = useState(false);
  const [rawHtmlBaseline, setRawHtmlBaseline] = useState(false);
  const [studioTab, setStudioTab] = useState('editor');
  const [reviewingId, setReviewingId] = useState(null);

  const detectedIndices = useMemo(
    () => parseIndexedVariablesFromHtml(`${draft.content}${draft.subject}`),
    [draft.content, draft.subject]
  );

  const [serverPreviewDoc, setServerPreviewDoc] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const localPreviewDoc = useMemo(() => {
    if (!draft.content?.trim() || useRawHtml) return '';
    return wrapVisualPreviewBody(inlineQuillIndentsInHtml(draft.content), { theme: 'light' });
  }, [draft.content, useRawHtml]);

  const previewHtml = useMemo(() => {
    if (serverPreviewDoc && !serverPreviewDoc.includes('Preview failed')) {
      return useRawHtml ? serverPreviewDoc : enhancePreviewDocument(serverPreviewDoc, { theme: 'light' });
    }
    if (localPreviewDoc) return localPreviewDoc;
    if (draft.content?.trim()) {
      return '<p style="padding:16px;font-family:sans-serif;color:#64748b">Loading preview…</p>';
    }
    return '<p style="padding:16px;font-family:sans-serif;color:#94a3b8">No preview available</p>';
  }, [serverPreviewDoc, localPreviewDoc, draft.content, useRawHtml]);

  useEffect(() => {
    if (!draft.content?.trim()) {
      setServerPreviewDoc('');
      setPreviewSubject('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const { data } = await axios.post('/api/mail/preview', {
          content: draft.content,
          subject: draft.subject || '',
          dummyValues: draft.dummyValues,
          format: useRawHtml ? 'rawHtml' : 'visual',
          removeUnsubscribe: true,
          theme: 'light',
        });
        if (!cancelled) {
          setServerPreviewDoc(data.html || '');
          setPreviewSubject(data.subject || applyDummyValuesPlain(draft.subject || '', draft.dummyValues));
        }
      } catch {
        if (!cancelled) {
          setServerPreviewDoc('<p style="padding:16px;color:#dc2626">Preview failed</p>');
          setPreviewSubject(applyDummyValuesPlain(draft.subject || '', draft.dummyValues));
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [draft.content, draft.subject, draft.dummyValues, useRawHtml]);

  const syncBaseline = (nextDraft, rawHtml = useRawHtml) => {
    const snap = cloneSnapshot(nextDraft);
    setDraftBaseline(snap);
    setRawHtmlBaseline(rawHtml);
  };

  const loadTemplate = (t) => {
    const dummies = t.dummyValues && typeof t.dummyValues === 'object'
      ? (t.dummyValues instanceof Map ? Object.fromEntries(t.dummyValues) : t.dummyValues)
      : {};
    const loaded = {
      id: t._id,
      name: t.name,
      subject: t.subject || '',
      content: getEffectiveTemplateContent(t) || '',
      format: t.format || 'visual',
      dummyValues: dummies,
      status: t.status,
    };
    setDraft(loaded);
    setUseRawHtml(t.format === 'rawHtml');
    syncBaseline(loaded, t.format === 'rawHtml');
    setServerPreviewDoc('');
    setPreviewSubject('');
    setStudioTab('editor');
  };

  const handleNew = () => {
    const fresh = emptyDraft();
    setDraft(fresh);
    setUseRawHtml(false);
    syncBaseline(fresh, false);
    setReviewingId(null);
    setStudioTab('editor');
  };

  const handleInsertVariable = () => {
    const idx = nextVariableIndex(draft.content);
    setDraft((prev) => ({
      ...prev,
      content: insertIndexedVariable(prev.content, idx),
    }));
  };

  const setDummy = (index, value) => {
    setDraft((prev) => ({
      ...prev,
      dummyValues: { ...prev.dummyValues, [index]: value },
    }));
  };

  const canSubmit = draft.name.trim()
    && draft.content.trim()
    && detectedIndices.every((i) => (draft.dummyValues[i] || draft.dummyValues[String(i)] || '').trim());

  const handleSaveDraft = async () => {
    if (!draft.name.trim() || !draft.content.trim()) {
      toast.warn('Template name and content are required');
      return;
    }
    try {
      const { data } = await saveMutation.mutateAsync({
        id: draft.id || undefined,
        name: draft.name.trim(),
        subject: draft.subject,
        content: draft.content,
        format: useRawHtml ? 'rawHtml' : 'visual',
        dummyValues: draft.dummyValues,
      });
      const saved = {
        ...draft,
        id: data._id,
        format: useRawHtml ? 'rawHtml' : 'visual',
        status: data.status || draft.status,
      };
      setDraft(saved);
      syncBaseline(saved, useRawHtml);
      toast.success(draft.status === 'approved' ? 'Approved template updated' : 'Template draft saved');
      refetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleSubmit = async () => {
    let id = draft.id;
    if (!id) {
      if (!draft.name.trim() || !draft.content.trim()) {
        toast.warn('Template name and content are required');
        return;
      }
      try {
        const { data } = await saveMutation.mutateAsync({
          name: draft.name.trim(),
          subject: draft.subject,
          content: draft.content,
          format: useRawHtml ? 'rawHtml' : 'visual',
          dummyValues: draft.dummyValues,
        });
        id = data._id;
        setDraft((prev) => ({ ...prev, id: data._id }));
      } catch (e) {
        toast.error(e.response?.data?.error || e.message);
        return;
      }
    }
    if (!canSubmit) {
      toast.warn('Fill dummy values for every variable');
      return;
    }
    try {
      await submitMutation.mutateAsync(id);
      toast.success('Submitted for admin approval');
      refetchAll();
      refetchPending();
      handleNew();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleApprove = async () => {
    if (!reviewingId) return;
    try {
      await approveMutation.mutateAsync({
        id: reviewingId,
        content: draft.content,
        subject: draft.subject,
      });
      toast.success('Template approved');
      setReviewingId(null);
      handleNew();
      refetchAll();
      refetchPending();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleReject = async () => {
    if (!reviewingId) return;
    const note = window.prompt('Rejection note (optional):') || '';
    try {
      await rejectMutation.mutateAsync({ id: reviewingId, rejectionNote: note });
      toast.success('Template rejected');
      setReviewingId(null);
      handleNew();
      refetchPending();
      refetchAll();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const myTemplates = allTemplates.filter(
    (t) => isAdmin || String(t.createdBy?._id || t.createdBy) === String(user?._id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={studioTab === 'editor' ? 'primary' : 'secondary'} onClick={() => setStudioTab('editor')}>
          <FileCode size={14} /> Editor
        </Button>
        <Button size="sm" variant={studioTab === 'library' ? 'primary' : 'secondary'} onClick={() => setStudioTab('library')}>
          My Templates
        </Button>
        {canApprove && (
          <Button size="sm" variant={studioTab === 'pending' ? 'primary' : 'secondary'} onClick={() => setStudioTab('pending')}>
            Pending Approval ({pendingTemplates.length})
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleNew}>+ New Template</Button>
      </div>

      {studioTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)]">
              {reviewingId ? 'Review Template' : 'Template Studio'}
            </h3>
            <Input label="Template Name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. May Outreach" />
            <Input label="Default Subject (optional)" value={draft.subject} onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject with {1} variables" />

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={useRawHtml} onChange={(e) => setUseRawHtml(e.target.checked)} />
              Raw HTML mode
            </label>

            <p className="text-[10px] text-[var(--color-text-muted)]">
              Type {'{1}'}, {'{2}'}, … in the editor or subject — detected automatically.
              {detectedIndices.length > 0 && (
                <span className="block mt-1 font-mono font-bold text-[var(--color-action-primary)]">
                  Found: {detectedIndices.map((i) => `{${i}}`).join(', ')}
                </span>
              )}
            </p>

            <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <Button size="xs" variant="secondary" onClick={handleInsertVariable} title="Insert next indexed variable into content">
                <Plus size={12} /> Insert Variable {nextVariableIndex(draft.content)}
              </Button>
              {detectedIndices.map((idx) => (
                <span key={idx} className="text-[10px] font-mono px-2 py-1 rounded bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
                  {`{${idx}}`}
                </span>
              ))}
            </div>

            {detectedIndices.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-2">
                <p className="text-[10px] font-bold text-yellow-600 uppercase">Dummy values for preview (shown as [value])</p>
                {detectedIndices.map((idx) => (
                  <Input
                    key={idx}
                    label={`{${idx}}`}
                    value={draft.dummyValues[idx] || draft.dummyValues[String(idx)] || ''}
                    onChange={(e) => setDummy(idx, e.target.value)}
                    placeholder="Sample value"
                  />
                ))}
              </div>
            )}

            {useRawHtml ? (
              <textarea
                className="w-full h-[280px] px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-mono outline-none resize-none"
                value={draft.content}
                onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))}
                placeholder="HTML with {1} {2} variables"
              />
            ) : (
              <div className="mail-template-quill rounded-lg overflow-hidden border border-[var(--color-bg-border)]">
                <ReactQuill
                  theme="snow"
                  value={draft.content}
                  onChange={(content, _delta, _source, editor) => {
                    const html = editor?.root?.innerHTML ?? content;
                    setDraft((p) => ({ ...p, content: html }));
                  }}
                  modules={MAIL_TEMPLATE_QUILL_MODULES}
                  formats={MAIL_TEMPLATE_QUILL_FORMATS}
                  className="h-[280px] mb-12"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {!reviewingId && (
                <>
                  <Button size="sm" variant="secondary" onClick={handleSaveDraft} disabled={saveMutation.isPending}>
                    <Save size={14} /> {draft.status === 'approved' ? 'Save changes' : 'Save Draft'}
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitMutation.isPending}>
                    <Send size={14} /> Submit for Approval
                  </Button>
                </>
              )}
              {reviewingId && canApprove && (
                <>
                  <Button size="sm" onClick={handleApprove} disabled={approveMutation.isPending}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="text-rose-500" onClick={handleReject} disabled={rejectMutation.isPending}>
                    <X size={14} /> Reject
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] lg:sticky lg:top-4 lg:self-start space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                <Eye size={12} /> Live Preview
              </div>
              {previewLoading && <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse">Updating…</span>}
            </div>
            <PreviewIframe html={previewHtml} minHeight={480} />
            {draft.subject && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Subject: {previewSubject || applyDummyValuesPlain(draft.subject, draft.dummyValues)}
              </p>
            )}
          </Card>
        </div>
      )}

      {studioTab === 'library' && (
        <div className="space-y-3">
          {myTemplates.map((t) => (
            <Card key={t._id} className="p-4 flex items-center justify-between gap-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <div>
                <span className="font-bold text-sm block">{t.name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {format(new Date(t.createdAt), 'MMM dd, yyyy')} ·{' '}
                  <Badge variant={t.status === 'approved' ? 'success' : t.status === 'rejected' ? 'danger' : 'warning'}>
                    {STATUS_LABELS[t.status] || t.status}
                  </Badge>
                </span>
                {t.rejectionNote && <p className="text-[10px] text-rose-500 mt-1">{t.rejectionNote}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => loadTemplate(t)}>Edit</Button>
                {t.status === 'approved' && onUseInCampaign && (
                  <Button size="sm" onClick={() => onUseInCampaign(t)}>Use in Campaign</Button>
                )}
                {t.status !== 'approved' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Delete template?', message: `Remove "${t.name}"?`, confirmLabel: 'Delete', type: 'danger' });
                      if (ok) deleteMutation.mutate(t._id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {myTemplates.length === 0 && (
            <div className="p-12 text-center opacity-40 border border-dashed rounded-2xl">
              <AlertCircle size={32} className="mx-auto mb-2" />
              <p className="text-[10px] font-black uppercase">No templates yet</p>
            </div>
          )}
        </div>
      )}

      {studioTab === 'pending' && canApprove && (
        <div className="space-y-3">
          {pendingTemplates.map((t) => (
            <Card key={t._id} className="p-4 flex items-center justify-between bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <div>
                <span className="font-bold text-sm">{t.name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)] block">
                  By {t.createdBy?.name || 'Unknown'} · {t.submittedAt ? format(new Date(t.submittedAt), 'MMM dd HH:mm') : '—'}
                </span>
              </div>
              <Button size="sm" onClick={() => { loadTemplate(t); setReviewingId(t._id); }}>Review</Button>
            </Card>
          ))}
          {pendingTemplates.length === 0 && (
            <p className="text-center text-xs text-[var(--color-text-muted)] py-8">No templates pending approval</p>
          )}
        </div>
      )}
    </div>
  );
}
