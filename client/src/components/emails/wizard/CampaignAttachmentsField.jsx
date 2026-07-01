import React, { useCallback, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Paperclip, Upload, X, ExternalLink, Eye, FileText, Image as ImageIcon, File,
  CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import { Badge, Button } from '../../ui';
import { useUploadCampaignAttachment } from '../../../hooks/useTaskmasterQueries';
import { useToast } from '../../../contexts/ToastContext';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(attachment) {
  const type = attachment?.contentType || '';
  const name = (attachment?.filename || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'file';
}

function FileTypeIcon({ attachment, size = 18 }) {
  const kind = fileKind(attachment);
  if (kind === 'image') return <ImageIcon size={size} className="text-sky-500" />;
  if (kind === 'pdf') return <FileText size={size} className="text-rose-500" />;
  return <File size={size} className="text-[var(--color-text-muted)]" />;
}

function AttachmentPreviewModal({ attachment, onClose }) {
  if (!attachment?.storageUrl) return null;
  const kind = fileKind(attachment);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${attachment.filename}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-bg-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <FileTypeIcon attachment={attachment} />
            <span className="text-sm font-semibold truncate">{attachment.filename}</span>
          </div>
          <Button size="xs" variant="ghost" onClick={onClose} aria-label="Close preview">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-[var(--color-bg-secondary)]/40 min-h-[240px] flex items-center justify-center">
          {kind === 'image' && (
            <img
              src={attachment.storageUrl}
              alt={attachment.filename}
              className="max-w-full max-h-[70vh] rounded-lg shadow-md object-contain"
            />
          )}
          {kind === 'pdf' && (
            <iframe
              title={attachment.filename}
              src={attachment.storageUrl}
              className="w-full h-[70vh] rounded-lg border border-[var(--color-bg-border)] bg-white"
            />
          )}
          {kind === 'file' && (
            <div className="text-center space-y-3 p-8">
              <File size={48} className="mx-auto text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">No inline preview for this file type.</p>
              <a
                href={attachment.storageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-action-primary)] hover:underline"
              >
                Open file <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadedAttachmentRow({ attachment, onRemove, onPreview }) {
  const kind = fileKind(attachment);
  const ready = Boolean(attachment.storageKey && attachment.storageUrl);

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/60">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {kind === 'image' && attachment.storageUrl ? (
          <button
            type="button"
            onClick={onPreview}
            className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-[var(--color-bg-border)] bg-white hover:ring-2 hover:ring-[var(--color-action-primary)]/40 transition-shadow"
            title="Preview image"
          >
            <img src={attachment.storageUrl} alt="" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-14 h-14 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] flex items-center justify-center">
            <FileTypeIcon attachment={attachment} size={22} />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold truncate">{attachment.filename}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {attachment.contentType || 'Unknown type'}
            {attachment.fileSize ? ` · ${formatFileSize(attachment.fileSize)}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {ready ? (
              <Badge variant="success" className="text-[9px] gap-1">
                <CheckCircle2 size={10} /> Uploaded · ready for every email
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[9px]">Processing…</Badge>
            )}
          </div>
          {ready && (
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-full" title={attachment.storageKey}>
              UploadThing · {attachment.storageKey}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0 sm:ml-auto">
        {ready && (
          <>
            <Button size="xs" variant="ghost" onClick={onPreview}>
              <Eye size={14} /> Preview
            </Button>
            <a
              href={attachment.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] hover:bg-[var(--color-bg-primary)]"
            >
              <ExternalLink size={12} /> Open
            </a>
          </>
        )}
        <Button size="xs" variant="ghost" className="text-rose-500 hover:text-rose-600" onClick={onRemove}>
          <X size={14} /> Remove
        </Button>
      </div>
    </li>
  );
}

export default function CampaignAttachmentsField() {
  const { watch, setValue, getValues } = useFormContext();
  const toast = useToast();
  const uploadMutation = useUploadCampaignAttachment();
  const inputRef = useRef(null);

  const attachments = watch('attachments') || [];
  const [pendingUploads, setPendingUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const uploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    for (const file of files) {
      const pendingId = `${file.name}-${Date.now()}-${Math.random()}`;
      setPendingUploads((prev) => [...prev, {
        id: pendingId,
        filename: file.name,
        fileSize: file.size,
        contentType: file.type,
      }]);

      try {
        const uploaded = await uploadMutation.mutateAsync(file);
        const current = getValues('attachments') || [];
        setValue('attachments', [...current, { ...uploaded, fileSize: file.size }], { shouldValidate: true });
        toast.success(`"${uploaded.filename}" uploaded — will attach to every email`);
      } catch (err) {
        toast.error(`"${file.name}" failed: ${err.response?.data?.error || err.message}`);
      } finally {
        setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
      }
    }
  }, [getValues, setValue, toast, uploadMutation]);

  const handleInputChange = (e) => {
    uploadFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const removeAttachment = (index) => {
    const current = getValues('attachments') || [];
    setValue('attachments', current.filter((_, i) => i !== index), { shouldValidate: true });
  };

  const isUploading = pendingUploads.length > 0 || uploadMutation.isPending;

  return (
    <div className="p-4 rounded-xl border border-[var(--color-bg-border)] space-y-4 bg-[var(--color-bg-secondary)]/30">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-[var(--color-action-primary)]" />
          <h5 className="text-sm font-semibold">Email attachments</h5>
          {attachments.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Files upload to secure storage (UploadThing). The same attachments are included on every recipient email and on test sends.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10'
            : 'border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/50 hover:bg-[var(--color-bg-secondary)]/80'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <Upload size={28} className={`mx-auto mb-2 ${dragOver ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'}`} />
        <p className="text-sm font-medium">Add attachments</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Click or drag files here · PDF, images, documents
        </p>
        {isUploading && (
          <p className="text-xs text-[var(--color-action-primary)] mt-2 flex items-center justify-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Uploading to UploadThing…
          </p>
        )}
      </div>

      {(pendingUploads.length > 0 || attachments.length > 0) && (
        <ul className="space-y-2">
          {pendingUploads.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-action-primary)]/30 bg-[var(--color-action-primary)]/5"
            >
              <Loader2 size={18} className="animate-spin shrink-0 text-[var(--color-action-primary)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.filename}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Uploading… {formatFileSize(p.fileSize)}
                </p>
              </div>
              <Badge variant="warning" className="text-[9px] shrink-0">Processing</Badge>
            </li>
          ))}
          {attachments.map((a, i) => (
            <UploadedAttachmentRow
              key={`${a.storageKey || a.filename}-${i}`}
              attachment={a}
              onRemove={() => removeAttachment(i)}
              onPreview={() => setPreviewAttachment(a)}
            />
          ))}
        </ul>
      )}

      {attachments.length === 0 && pendingUploads.length === 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
          <AlertCircle size={12} /> No attachments yet — optional for this campaign.
        </p>
      )}

      {attachments.length > 0 && attachments.every((a) => a.storageKey && a.storageUrl) && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            All {attachments.length} attachment{attachments.length !== 1 ? 's are' : ' is'} stored on UploadThing and will be sent with each email when you dispatch.
          </p>
        </div>
      )}

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
