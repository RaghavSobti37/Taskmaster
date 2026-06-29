import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import '../../utils/mailTemplateQuillSetup';
import { MAIL_TEMPLATE_QUILL_KEYBOARD, attachMailTemplateClipboardSanitizer } from '../../utils/mailTemplateQuillSetup';
import { FileCode, Plus, Save, Send, Check, X, Trash2, Eye, AlertCircle, Image as ImageIcon, Copy } from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../ui/QueryErrorBanner';
import { format } from 'date-fns';
import {
  useMailTemplates,
  usePendingMailTemplates,
  useSaveMailTemplate,
  useSubmitMailTemplate,
  useApproveMailTemplate,
  useRejectMailTemplate,
  useDeleteMailTemplate,
  usePlatformExclusions,
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
import { useDebounce } from '../../hooks/useDebounce';
import PreviewIframe from '../emails/PreviewIframe';
import {
  canonicalizeVisualMailHtml,
  repairIndentDrift,
  wrapVisualPreviewBody,
} from '../../utils/visualEmailHtml';
import {
  buildInlineImageTag,
  insertHtmlAtTextareaCursor,
  insertImageInQuill,
  uploadMailTemplateImage,
} from '../../utils/mailTemplateImageUpload';
import { blobToCroppedFile } from '../../utils/mailTemplateImageCrop';
import MailTemplateImageCropModal from './MailTemplateImageCropModal';

const PREVIEW_DEBOUNCE_MS = 450;
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
  assets: [],
});

const MAIL_TEMPLATE_QUILL_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline'],
  ['link', 'image'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['clean'],
];

const MAIL_TEMPLATE_QUILL_MODULES = {
  toolbar: MAIL_TEMPLATE_QUILL_TOOLBAR,
  clipboard: { matchVisual: false },
  keyboard: MAIL_TEMPLATE_QUILL_KEYBOARD,
};

const MAIL_TEMPLATE_QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'link', 'image', 'list', 'bullet', 'indent', 'break',
];

export default function MailTemplateStudio({ onUseInCampaign }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { data: platformExclusions = {} } = usePlatformExclusions();
  const isAdmin = isAdminUser(user);
  const canApprove = canApproveMailTemplates(user, platformExclusions);

  const {
    data: allTemplates = [],
    isError: templatesError,
    error: templatesErr,
    refetch: refetchAll,
  } = useMailTemplates();
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
  const [imageUploading, setImageUploading] = useState(false);
  const [pendingCrop, setPendingCrop] = useState(null);
  const quillRef = useRef(null);
  const rawHtmlRef = useRef(null);
  const imageInputRef = useRef(null);

  const bindQuillPasteSanitizer = useCallback((editor) => {
    if (!editor?.getEditor) return;
    attachMailTemplateClipboardSanitizer(editor.getEditor());
  }, []);

  const trackUploadedAsset = useCallback((asset) => {
    if (!asset?.url) return;
    setDraft((prev) => {
      const existing = prev.assets || [];
      if (existing.some((a) => a.url === asset.url)) return prev;
      return { ...prev, assets: [...existing, asset] };
    });
  }, []);

  const insertImageUrl = useCallback((url) => {
    if (!url) return;
    if (useRawHtml && rawHtmlRef.current) {
      const tag = buildInlineImageTag(url);
      const next = insertHtmlAtTextareaCursor(rawHtmlRef.current, tag);
      setDraft((prev) => ({ ...prev, content: next }));
      return;
    }
    const quill = quillRef.current?.getEditor?.();
    if (quill) insertImageInQuill(quill, url);
  }, [useRawHtml]);

  const handleImageUpload = useCallback(async (file) => {
    if (!file) return null;
    setImageUploading(true);
    try {
      const asset = await uploadMailTemplateImage(file);
      trackUploadedAsset(asset);
      return asset.url;
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
      return null;
    } finally {
      setImageUploading(false);
    }
  }, [toast, trackUploadedAsset]);

  const clearPendingCrop = useCallback(() => {
    setPendingCrop((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
  }, []);

  const handleImageInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearPendingCrop();
    setPendingCrop({
      file,
      objectUrl: URL.createObjectURL(file),
    });
  }, [clearPendingCrop]);

  const handleCropCancel = useCallback(() => {
    clearPendingCrop();
  }, [clearPendingCrop]);

  const handleCropConfirm = useCallback(async (croppedBlob) => {
    const source = pendingCrop;
    if (!croppedBlob || !source?.file) return;
    const croppedFile = blobToCroppedFile(croppedBlob, source.file.name, source.file.type);
    clearPendingCrop();
    const url = await handleImageUpload(croppedFile);
    if (url) insertImageUrl(url);
  }, [pendingCrop, clearPendingCrop, handleImageUpload, insertImageUrl]);

  useEffect(() => () => {
    if (pendingCrop?.objectUrl) URL.revokeObjectURL(pendingCrop.objectUrl);
  }, [pendingCrop?.objectUrl]);

  const openImagePicker = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const copyAssetUrl = useCallback(async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Image URL copied');
    } catch {
      toast.warn('Could not copy URL');
    }
  }, [toast]);

  const quillModules = useMemo(() => ({
    ...MAIL_TEMPLATE_QUILL_MODULES,
    toolbar: {
      container: MAIL_TEMPLATE_QUILL_TOOLBAR,
      handlers: {
        image: () => openImagePicker(),
      },
    },
  }), [openImagePicker]);


  const detectedIndices = useMemo(
    () => parseIndexedVariablesFromHtml(`${draft.content}${draft.subject}`),
    [draft.content, draft.subject]
  );

  const [serverPreviewDoc, setServerPreviewDoc] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const debouncedContent = useDebounce(draft.content, PREVIEW_DEBOUNCE_MS);
  const debouncedSubject = useDebounce(draft.subject, PREVIEW_DEBOUNCE_MS);

  const visualContentForSave = useCallback(() => (
    useRawHtml ? draft.content : canonicalizeVisualMailHtml(draft.content)
  ), [draft.content, useRawHtml]);

  const previewBodyHtml = useMemo(() => {
    if (!debouncedContent?.trim()) return '';
    return useRawHtml ? debouncedContent : canonicalizeVisualMailHtml(debouncedContent);
  }, [debouncedContent, useRawHtml]);

  const localPreviewDoc = useMemo(() => {
    if (!previewBodyHtml) return '';
    return wrapVisualPreviewBody(previewBodyHtml, { theme: 'light' });
  }, [previewBodyHtml]);

  const previewSource = useMemo(() => {
    if (previewLoading) return 'updating';
    if (serverPreviewDoc && !serverPreviewDoc.includes('Preview failed')) return 'server';
    if (localPreviewDoc) return 'local';
    return 'none';
  }, [previewLoading, serverPreviewDoc, localPreviewDoc]);

  const previewSourceLabel = {
    updating: 'Updating…',
    server: 'Server validated',
    local: 'Local fallback',
    none: '',
  }[previewSource];

  const previewSourceVariant = {
    updating: 'warning',
    server: 'success',
    local: 'secondary',
    none: 'secondary',
  }[previewSource];

  const previewHtml = useMemo(() => {
    if (serverPreviewDoc && !serverPreviewDoc.includes('Preview failed')) {
      return serverPreviewDoc;
    }
    if (localPreviewDoc) return localPreviewDoc;
    if (draft.content?.trim()) {
      return '<p style="padding:16px;font-family:sans-serif;color:#64748b">Loading preview…</p>';
    }
    return '<p style="padding:16px;font-family:sans-serif;color:#94a3b8">No preview available</p>';
  }, [serverPreviewDoc, localPreviewDoc, draft.content, useRawHtml]);

  useEffect(() => {
    if (studioTab !== 'editor') return undefined;
    if (!previewBodyHtml?.trim()) {
      setServerPreviewDoc('');
      setPreviewSubject('');
      setPreviewLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const { data } = await axios.post('/api/mail/preview', {
          content: previewBodyHtml,
          subject: debouncedSubject || '',
          dummyValues: draft.dummyValues,
          format: useRawHtml ? 'rawHtml' : 'visual',
          removeUnsubscribe: true,
          theme: 'light',
        });
        if (!cancelled) {
          setServerPreviewDoc(data.html || '');
          setPreviewSubject(data.subject || applyDummyValuesPlain(debouncedSubject || '', draft.dummyValues));
        }
      } catch {
        if (!cancelled) {
          setServerPreviewDoc('<p style="padding:16px;color:#dc2626">Preview failed</p>');
          setPreviewSubject(applyDummyValuesPlain(debouncedSubject || '', draft.dummyValues));
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [previewBodyHtml, debouncedSubject, draft.dummyValues, useRawHtml, studioTab]);

  const syncBaseline = (nextDraft, rawHtml = useRawHtml) => {
    const snap = cloneSnapshot(nextDraft);
    setDraftBaseline(snap);
    setRawHtmlBaseline(rawHtml);
  };

  const loadTemplate = (t) => {
    const dummies = t.dummyValues && typeof t.dummyValues === 'object'
      ? (t.dummyValues instanceof Map ? Object.fromEntries(t.dummyValues) : t.dummyValues)
      : {};
    const rawContent = getEffectiveTemplateContent(t) || '';
    const loaded = {
      id: t._id,
      name: t.name,
      subject: t.subject || '',
      content: rawContent,
      format: t.format || 'visual',
      dummyValues: dummies,
      status: t.status,
      assets: Array.isArray(t.assets) ? t.assets : [],
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
    const content = visualContentForSave();
    try {
      const { data } = await saveMutation.mutateAsync({
        id: draft.id || undefined,
        name: draft.name.trim(),
        subject: draft.subject,
        content,
        format: useRawHtml ? 'rawHtml' : 'visual',
        dummyValues: draft.dummyValues,
        assets: draft.assets || [],
      });
      const saved = {
        ...draft,
        content,
        id: data._id,
        format: useRawHtml ? 'rawHtml' : 'visual',
        status: data.status || draft.status,
        assets: data.assets || draft.assets || [],
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
        const content = visualContentForSave();
        const { data } = await saveMutation.mutateAsync({
          name: draft.name.trim(),
          subject: draft.subject,
          content,
          format: useRawHtml ? 'rawHtml' : 'visual',
          dummyValues: draft.dummyValues,
          assets: draft.assets || [],
        });
        id = data._id;
        setDraft((prev) => ({ ...prev, id: data._id, assets: data.assets || prev.assets || [] }));
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
        content: visualContentForSave(),
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
      {templatesError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(templatesErr, 'Failed to load templates')}
          onRetry={() => refetchAll()}
        />
      )}
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

      <div className={studioTab === 'editor' ? undefined : 'hidden'} aria-hidden={studioTab !== 'editor'}>
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
              <Button
                size="xs"
                variant="secondary"
                onClick={() => openImagePicker()}
                disabled={imageUploading}
                title="Upload image and insert inline"
              >
                <ImageIcon size={12} /> {imageUploading ? 'Uploading…' : 'Insert Image'}
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageInputChange}
              />
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
                ref={rawHtmlRef}
                className="w-full h-[280px] px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-mono outline-none resize-none"
                value={draft.content}
                onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))}
                placeholder="HTML with {1} {2} variables and <img src=&quot;https://...&quot; /> tags"
              />
            ) : (
              <div className="space-y-1">
                <div className="mail-template-quill rounded-lg overflow-hidden border border-[var(--color-bg-border)] shadow-sm">
                  <ReactQuill
                    ref={(editor) => {
                      quillRef.current = editor;
                      bindQuillPasteSanitizer(editor);
                    }}
                    theme="snow"
                    value={draft.content}
                    onChange={(content, _delta, _source, editor) => {
                      const html = editor?.root?.innerHTML ?? content;
                      setDraft((p) => ({ ...p, content: repairIndentDrift(html) }));
                    }}
                    modules={quillModules}
                    formats={MAIL_TEMPLATE_QUILL_FORMATS}
                    className="h-[280px] mb-12"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  <span className="font-semibold text-[var(--color-text-secondary)]">Enter</span>
                  {' = new line · '}
                  <span className="font-semibold text-[var(--color-text-secondary)]">Shift+Enter</span>
                  {' = new paragraph (email spacing) · '}
                  <span className="font-semibold text-[var(--color-text-secondary)]">Image</span>
                  {' = upload hosted inline image'}
                </p>
              </div>
            )}

            {(draft.assets || []).length > 0 && (
              <div className="p-3 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/60 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Template images
                </p>
                <div className="flex flex-wrap gap-2">
                  {(draft.assets || []).map((asset) => (
                    <div
                      key={asset.url}
                      className="group relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
                    >
                      <img src={asset.url} alt={asset.name || ''} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 flex items-center justify-center gap-1 transition-opacity">
                        <button
                          type="button"
                          className="p-1 rounded bg-white/90 text-[var(--color-text-primary)]"
                          title="Insert at cursor"
                          onClick={() => insertImageUrl(asset.url)}
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded bg-white/90 text-[var(--color-text-primary)]"
                          title="Copy URL"
                          onClick={() => copyAssetUrl(asset.url)}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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

          <Card className="p-4 bg-[var(--color-bg-secondary)]/40 border border-[var(--color-bg-border)] lg:sticky lg:top-4 lg:self-start space-y-2 ring-1 ring-[var(--color-bg-border)]/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                <Eye size={12} /> Live Preview
              </div>
              {previewSourceLabel && (
                <Badge variant={previewSourceVariant} className="text-[9px] uppercase tracking-wide">
                  {previewSourceLabel}
                </Badge>
              )}
            </div>
            <PreviewIframe html={previewHtml} minHeight={480} />
            {draft.subject && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Subject: {previewSubject || applyDummyValuesPlain(draft.subject, draft.dummyValues)}
              </p>
            )}
          </Card>
        </div>
      </div>

      {studioTab === 'library' && (
        <div className="space-y-3">
          {myTemplates.map((t) => (
            <Card key={t._id} className="p-4 flex items-center justify-between gap-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <div>
                <span className="font-bold text-sm block">{t.name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {formatDisplayDate(new Date(t.createdAt))} ·{' '}
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
                  By {t.createdBy?.name || 'Unknown'} · {t.submittedAt ? formatDisplayDateTime(new Date(t.submittedAt)) : '—'}
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

      <MailTemplateImageCropModal
        isOpen={Boolean(pendingCrop)}
        imageSrc={pendingCrop?.objectUrl}
        fileName={pendingCrop?.file?.name}
        sourceType={pendingCrop?.file?.type}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
