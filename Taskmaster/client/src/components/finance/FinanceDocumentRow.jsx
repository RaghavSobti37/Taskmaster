import React from 'react';
import { Eye, Download, Trash2, FolderOpen, ChevronRight, Loader2, Check } from 'lucide-react';
import { UserLabel } from '../ui';
import { formatProjectName } from '../../utils/projectUtils';
import {
  FINANCE_CAT_COLORS,
  formatFinanceBytes,
  formatFinanceDocDate,
  getFinanceFileIcon,
} from '../../utils/financeDisplay';

/** OCR / upload pipeline states for staged files and row hints. */
export const FINANCE_UPLOAD_STATES = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PARSING: 'parsing',
  COMPLETE: 'complete',
};

export function FinanceUploadStateBadge({ state = FINANCE_UPLOAD_STATES.IDLE, className = '' }) {
  if (state === FINANCE_UPLOAD_STATES.IDLE) return null;
  const labels = {
    [FINANCE_UPLOAD_STATES.UPLOADING]: 'Uploading…',
    [FINANCE_UPLOAD_STATES.PARSING]: 'Parsing OCR…',
    [FINANCE_UPLOAD_STATES.COMPLETE]: 'Ready',
  };
  const tones = {
    [FINANCE_UPLOAD_STATES.UPLOADING]: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    [FINANCE_UPLOAD_STATES.PARSING]: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    [FINANCE_UPLOAD_STATES.COMPLETE]: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${tones[state] || ''} ${className}`}>
      {state === FINANCE_UPLOAD_STATES.PARSING && <Loader2 size={10} className="animate-spin" />}
      {state === FINANCE_UPLOAD_STATES.COMPLETE && <Check size={10} />}
      {labels[state]}
    </span>
  );
}

export function FinanceUploadProgressBar({ progress = 0 }) {
  const pct = Math.min(100, Math.max(0, Number(progress) || 0));
  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--color-bg-border)] overflow-hidden">
      <div
        className="h-full bg-[var(--color-action-primary)] transition-all duration-200"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function FinanceDividerLabel({ label }) {
  return (
    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
      {label}
    </span>
  );
}

export function FinanceFolderNameCell({ doc }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15 border border-amber-500/30">
        <FolderOpen size={18} className="text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-amber-600 transition-colors">
          {doc.folderName}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          {doc.documentCount ?? 0} document{(doc.documentCount ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

export function FinanceDocNameCell({ doc }) {
  const FileIcon = getFinanceFileIcon(doc.fileType);
  const isImage = doc.fileType?.includes('image') || /\.(png|jpe?g|webp)$/i.test(doc.fileName || '');
  return (
    <div className="flex items-center gap-3 min-w-0">
      {isImage ? (
        <img src={doc.fileUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-[var(--color-bg-border)] flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-bg-workspace)] flex-shrink-0 border border-[var(--color-bg-border)]">
          <FileIcon size={16} className="text-[var(--color-text-muted)]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold text-[var(--color-text-primary)] group-hover:text-blue-500 transition-colors truncate max-w-[280px]">
          {doc.title}
        </p>
        {doc.fileName && (
          <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[200px]">{doc.fileName}</p>
        )}
      </div>
    </div>
  );
}

export function FinanceCategoryBadge({ category, isFolder }) {
  if (isFolder) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400">
        Folder
      </span>
    );
  }
  const cat = FINANCE_CAT_COLORS[category] || FINANCE_CAT_COLORS.other;
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
      style={{ background: cat.bg, color: cat.text }}
    >
      {category}
    </span>
  );
}

export function FinanceDocActions({
  doc,
  isFolder,
  onView,
  onDelete,
  onDeleteFolder,
  deleteFolderPending,
  onConfirmDelete,
}) {
  if (doc._isDivider) return null;

  if (isFolder) {
    return (
      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onDeleteFolder}
          disabled={deleteFolderPending}
          className="p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
          title="Delete folder"
        >
          <Trash2 size={14} />
        </button>
        <ChevronRight size={16} className="text-[var(--color-text-muted)] group-hover:text-amber-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity justify-end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onView?.(doc); }}
        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-[var(--color-text-secondary)] transition-colors"
      >
        <Eye size={14} />
      </button>
      <a
        href={doc.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-blue-500 transition-colors"
      >
        <Download size={14} />
      </a>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          const ok = await onConfirmDelete?.(doc);
          if (ok) onDelete?.(doc._id);
        }}
        className="p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function FinanceProjectCell({ doc }) {
  const name = doc.isFolder
    ? formatProjectName(doc.project?.name) || '—'
    : doc.project?.name || '—';
  return <span className="text-xs font-bold text-[var(--color-text-secondary)]">{name}</span>;
}

export function FinanceUploaderCell({ doc }) {
  if (doc.isFolder || doc._isDivider) return null;
  return (
    <UserLabel
      user={doc.uploadedBy}
      name={doc.uploadedBy?.name || '—'}
      size="xs"
      nameClassName="text-[10px] font-bold text-[var(--color-text-secondary)] truncate max-w-[120px]"
    />
  );
}

export function FinanceSizeCell({ doc }) {
  if (doc.isFolder || doc._isDivider) return null;
  return <span className="text-xs text-[var(--color-text-muted)]">{formatFinanceBytes(doc.fileSize)}</span>;
}

export function FinanceDocDateCell({ doc }) {
  if (doc.isFolder || doc._isDivider) return null;
  return <span className="text-[10px] text-[var(--color-text-muted)]">{formatFinanceDocDate(doc)}</span>;
}
