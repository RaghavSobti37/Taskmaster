import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, ExternalLink, FileText, Link2, Trash2, X,
} from 'lucide-react';
import { ORG_DOCUMENT_CATEGORIES } from '@shared/orgDocumentCategories';
import FinanceDocumentPreview from '../finance/FinanceDocumentPreview';
import { isFinanceImage, isFinancePdf } from '../../utils/financeFilePreview';
import { formatFinanceBytes } from '../../utils/financeDisplay';
import { formatDisplayDateTime } from '../../utils/dateDisplay';
import { ESCAPE_OVERLAY_PROPS } from '../../lib/escapeBack';
import { orgDocumentPreviewPath } from '../../utils/orgDocumentEditForm';

export default function OrgDocumentWorkspacePanel({
  doc,
  editForm,
  hasEdits,
  isSaving,
  onClose,
  onRevert,
  onSave,
  onDelete,
  onEditChange,
}) {
  if (!doc || !editForm) return null;

  const isFile = doc.sourceType === 'file';
  const isLink = doc.sourceType === 'link';
  const previewPath = orgDocumentPreviewPath(doc);
  const canInlinePreview = isFile && (isFinancePdf(doc) || isFinanceImage(doc));

  const openHref = isFile
    ? previewPath
    : (doc.externalUrl?.startsWith('http') ? doc.externalUrl : `https://${doc.externalUrl || ''}`);

  return (
    <motion.div
      {...ESCAPE_OVERLAY_PROPS}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/80 z-[80] flex items-center justify-end"
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full h-full bg-[var(--color-bg-surface)] border-l border-[var(--color-bg-border)] flex flex-col md:flex-row shadow-2xl overflow-hidden"
      >
        <div className="flex-1 bg-slate-950 flex flex-col relative h-[50vh] md:h-full">
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center gap-3 shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all text-xs font-bold"
              title="Close Preview (Esc)"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
            <span className="text-[10px] font-bold text-slate-300 truncate max-w-[320px]">
              {isFile ? (doc.fileName || doc.title) : doc.title}
            </span>
          </div>

          <div className="w-full h-full flex items-center justify-center p-6">
            {isLink ? (
              <div className="text-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl max-w-sm">
                <Link2 size={48} className="mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-300">External link</p>
                <p className="text-xs text-slate-500 mt-1 break-all">{doc.externalUrl}</p>
                <a
                  href={openHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-action-primary)] text-white rounded-[var(--radius-atomic)] text-xs font-bold hover:opacity-90 transition-colors"
                >
                  <ExternalLink size={14} /> Open link
                </a>
              </div>
            ) : canInlinePreview ? (
              <FinanceDocumentPreview
                doc={doc}
                previewPath={previewPath}
                iframeClassName="w-full h-full rounded-xl border border-slate-800 shadow-2xl bg-slate-900"
                imgClassName="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800"
                className="w-full h-full"
              />
            ) : (
              <div className="text-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl max-w-sm">
                <FileText size={48} className="mx-auto text-slate-500 mb-3" />
                <p className="text-sm font-bold text-slate-300">Preview not supported</p>
                <p className="text-xs text-slate-500 mt-1">Download the document to view its contents.</p>
                <a
                  href={openHref}
                  download={isFile}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-action-primary)] text-white rounded-[var(--radius-atomic)] text-xs font-bold hover:opacity-90 transition-colors"
                >
                  <Download size={14} /> Download file
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-[var(--color-bg-border)] h-[50vh] md:h-full flex flex-col bg-[var(--color-bg-surface)]">
          <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Document details</h3>
              <p className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-[280px]">{doc.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {openHref && (
                <a
                  href={openHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={isFile}
                  className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-secondary)] transition-colors"
                  title={isLink ? 'Open link' : 'Download'}
                >
                  {isLink ? <ExternalLink size={14} /> : <Download size={14} />}
                </a>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-secondary)] transition-colors md:hidden"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-4 text-left">
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Title *</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => onEditChange({ title: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50"
              />
            </div>

            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => onEditChange({ description: e.target.value })}
                placeholder="Add brief details..."
                rows={2}
                className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-action-primary)]/50 resize-none"
              />
            </div>

            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Category</label>
              <select
                value={editForm.category}
                onChange={(e) => onEditChange({ category: e.target.value })}
                className="w-full px-2 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50 cursor-pointer"
              >
                {ORG_DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Tags</label>
              <input
                type="text"
                value={editForm.tags}
                onChange={(e) => onEditChange({ tags: e.target.value })}
                placeholder="comma-separated"
                className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50"
              />
            </div>

            {isLink && doc.externalUrl && (
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">External URL</label>
                <div className="px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] break-all">
                  {doc.externalUrl}
                </div>
              </div>
            )}

            <div className="border-t border-[var(--color-bg-border)] pt-4 space-y-2 text-[10px] text-[var(--color-text-muted)]">
              <div className="flex justify-between">
                <span>Type</span>
                <span className="font-bold text-[var(--color-text-primary)] capitalize">{doc.sourceType}</span>
              </div>
              <div className="flex justify-between">
                <span>Uploaded by</span>
                <span className="font-bold text-[var(--color-text-primary)]">{doc.uploadedBy?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Uploaded on</span>
                <span className="font-bold text-[var(--color-text-primary)]">
                  {formatDisplayDateTime(new Date(doc.createdAt))}
                </span>
              </div>
              {isFile && (
                <>
                  <div className="flex justify-between">
                    <span>File type</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{doc.fileType || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File size</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{formatFinanceBytes(doc.fileSize)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] flex items-center justify-between gap-3">
            {hasEdits ? (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Unsaved changes</span>
            ) : (
              <span className="text-[10px] text-[var(--color-text-muted)]">All changes saved</span>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRevert}
                disabled={!hasEdits || isSaving}
                className="px-4 py-2 text-xs font-bold rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] disabled:opacity-40 transition-all"
              >
                Revert
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!hasEdits || isSaving}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-[var(--radius-atomic)] hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-[var(--radius-atomic)] hover:opacity-90 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
