import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Upload, X, FileText, Loader2, FolderOpen, FolderPlus, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { FinanceUploadProgressBar, FinanceUploadStateBadge, FINANCE_UPLOAD_STATES } from './FinanceDocumentRow';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/ModalShell';
import WorkspaceProjectFields, { filterProjectsByWorkspace } from '../forms/WorkspaceProjectFields';
import { fetchNextFinanceReferences, parseFinanceDocumentPreview } from '../../utils/financeUpload';
import { isFinancePdf } from '../../utils/financeFilePreview';
import FinanceDocumentPreview from './FinanceDocumentPreview';
import { FINANCE_CURRENCY_OPTIONS, normalizeFinanceCurrency } from '../../utils/financeCurrency';

const CATEGORIES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'budget', label: 'Budget' },
  { value: 'report', label: 'Report' },
  { value: 'tax', label: 'Tax' },
  { value: 'other', label: 'Other' },
];

const ROOT_FOLDER_VALUE = '__root__';
const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review' },
];

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const emptyOcrMetadata = () => ({
  vendor: '',
  amount: '',
  tax: '',
  date: '',
  currency: 'INR',
});

const FolderCombobox = ({
  projectId,
  folders,
  value,
  folderLabel,
  onChange,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(folderLabel || '');
  const ref = useRef(null);

  useEffect(() => {
    setQuery(folderLabel || '');
  }, [folderLabel, value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const trimmed = query.trim();
  const matchingFolder = folders.find(
    (f) => f.folderName.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreateOption = trimmed.length > 0 && !matchingFolder && projectId;

  const options = useMemo(() => {
    const list = [
      { id: ROOT_FOLDER_VALUE, label: 'Project root (no folder)', isRoot: true },
      ...folders.map((f) => ({ id: f._id, label: f.folderName, isRoot: false })),
    ];
    if (!trimmed) return list;
    return list.filter((o) =>
      o.isRoot ? 'root'.includes(trimmed.toLowerCase())
        : o.label.toLowerCase().includes(trimmed.toLowerCase()),
    );
  }, [folders, trimmed]);

  const pick = (id, label) => {
    if (id === ROOT_FOLDER_VALUE) {
      onChange({ folderId: null, folderLabel: '', newFolderName: '' });
    } else {
      onChange({ folderId: id, folderLabel: label, newFolderName: '' });
    }
    setQuery(label || '');
    setOpen(false);
  };

  const pickCreate = () => {
    onChange({
      folderId: null,
      folderLabel: trimmed,
      newFolderName: trimmed,
    });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
        <FolderOpen size={10} /> Folder
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled || !projectId}
          placeholder={projectId ? 'Select folder or type new name…' : 'Select a project first'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) {
              onChange({ folderId: null, folderLabel: '', newFolderName: '' });
            } else {
              const match = folders.find(
                (f) => f.folderName.toLowerCase() === e.target.value.trim().toLowerCase(),
              );
              if (match) {
                onChange({ folderId: match._id, folderLabel: match.folderName, newFolderName: '' });
              } else {
                onChange({
                  folderId: null,
                  folderLabel: e.target.value.trim(),
                  newFolderName: e.target.value.trim(),
                });
              }
            }
          }}
          onFocus={() => setOpen(true)}
          className="w-full px-3 py-2 pr-8 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-sm disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || !projectId}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {open && projectId && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg shadow-xl text-sm">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-[var(--color-bg-workspace)] ${
                  value === o.id || (!value && o.isRoot) ? 'bg-[var(--color-bg-workspace)] font-bold' : ''
                }`}
                onClick={() => pick(o.id, o.isRoot ? '' : o.label)}
              >
                {o.label}
              </button>
            </li>
          ))}
          {showCreateOption && (
            <li>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2"
                onClick={pickCreate}
              >
                <FolderPlus size={14} />
                Create folder &quot;{trimmed}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

const StepIndicator = ({ step }) => (
  <ol className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
    {STEPS.map((s, idx) => {
      const done = step > s.id;
      const active = step === s.id;
      return (
        <React.Fragment key={s.id}>
          {idx > 0 && <ChevronRight size={12} className="text-[var(--color-text-muted)] opacity-50" />}
          <li
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
              active ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : done ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {done ? <Check size={12} /> : <span className="w-4 text-center">{s.id}</span>}
            {s.label}
          </li>
        </React.Fragment>
      );
    })}
  </ol>
);

const UploadDocumentModal = ({
  isOpen,
  onClose,
  stagedFiles,
  setStagedFiles,
  projects,
  selectedProject,
  currentFolderId,
  currentFolder,
  selectedProjectName,
  isUploading,
  uploadProgress,
  onFilesSelected,
  onBulkSubmit,
  isSubmitting,
}) => {
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);
  const [step, setStep] = useState(1);

  const [uploadWorkspace, setUploadWorkspace] = useState('General');
  const [uploadProject, setUploadProject] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [uploadFolderLabel, setUploadFolderLabel] = useState('');
  const [uploadNewFolderName, setUploadNewFolderName] = useState('');
  const [resolvingFolders, setResolvingFolders] = useState(false);
  const [defaultReferenceNumber, setDefaultReferenceNumber] = useState('');
  const [loadingReference, setLoadingReference] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      return;
    }
    const initialProject = selectedProject || '';
    const initialProjectRecord = projects.find((p) => p._id === initialProject);
    setUploadWorkspace(initialProjectRecord?.workspace || 'General');
    setUploadProject(initialProject);
    setUploadFolderId(currentFolderId || null);
    setUploadFolderLabel(currentFolder?.folderName || '');
    setUploadNewFolderName('');
    setDefaultReferenceNumber('');
    setStep(1);
  }, [isOpen, selectedProject, currentFolderId, currentFolder?.folderName, projects]);

  useEffect(() => {
    if (!isOpen || !uploadProject) {
      setDefaultReferenceNumber('');
      return undefined;
    }

    let cancelled = false;
    setLoadingReference(true);
    fetchNextFinanceReferences(uploadProject, Math.max(1, stagedFiles.length || 1))
      .then((refs) => {
        if (!cancelled) setDefaultReferenceNumber(refs[0] || '');
      })
      .catch((err) => {
        console.error('Failed to load reference number:', err);
        if (!cancelled) setDefaultReferenceNumber('');
      })
      .finally(() => {
        if (!cancelled) setLoadingReference(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, uploadProject, stagedFiles.length]);

  const { data: foldersRes } = useQuery({
    queryKey: ['finance-folders', uploadProject],
    queryFn: async () => {
      if (!uploadProject) return { data: [] };
      return (await axios.get(`/api/finance/folders?project=${uploadProject}`)).data;
    },
    enabled: isOpen && !!uploadProject,
  });

  const projectFolders = foldersRes?.data || [];

  const runOcrForFile = useCallback(async (file) => {
    if (!file?.fileUrl || file.ocrStatus === 'parsing' || file.ocrStatus === 'done') return;
    setStagedFiles((prev) => prev.map((f) => (
      f.id === file.id ? { ...f, ocrStatus: 'parsing' } : f
    )));

    try {
      const result = await parseFinanceDocumentPreview({
        fileUrl: file.fileUrl,
        fileKey: file.fileKey,
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType,
      });
      const meta = result.metadata || {};
      const dateStr = meta.date ? new Date(meta.date).toISOString().slice(0, 10) : '';
      setStagedFiles((prev) => prev.map((f) => {
        if (f.id !== file.id) return f;
        return {
          ...f,
          ocrStatus: 'done',
          ocrMetadata: {
            vendor: meta.vendor || '',
            amount: meta.amount ? String(meta.amount) : '',
            tax: meta.tax ? String(meta.tax) : '',
            date: dateStr,
            currency: normalizeFinanceCurrency(meta.currency),
          },
          category: meta.detectedCategory && meta.detectedCategory !== 'other' ? meta.detectedCategory : f.category,
        };
      }));
    } catch (err) {
      console.error('OCR preview failed:', err);
      setStagedFiles((prev) => prev.map((f) => (
        f.id === file.id ? { ...f, ocrStatus: 'error', ocrMetadata: emptyOcrMetadata() } : f
      )));
    }
  }, [setStagedFiles]);

  useEffect(() => {
    if (!isOpen || step < 2) return;
    stagedFiles
      .filter((f) => f.fileUrl && f.ocrStatus === 'idle')
      .forEach((f) => {
        runOcrForFile(f);
      });
  }, [isOpen, step, stagedFiles, runOcrForFile]);

  const applyDefaultsToStaged = (project, folderId, folderLabel, newFolderName, referenceNumber) => {
    setStagedFiles((prev) =>
      prev.map((f) => ({
        ...f,
        project: project || f.project,
        folderId: folderId ?? null,
        folderLabel: folderLabel || '',
        newFolderName: newFolderName || '',
        referenceNumber: referenceNumber ?? f.referenceNumber ?? '',
      })),
    );
  };

  const refreshReferenceForFile = async (fileId, projectId) => {
    if (!projectId) return;
    try {
      const [referenceNumber] = await fetchNextFinanceReferences(projectId, 1);
      if (!referenceNumber) return;
      setStagedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, referenceNumber } : f)),
      );
    } catch (err) {
      console.error('Failed to fetch reference number:', err);
    }
  };

  const handleProjectChange = async ({ workspace, projectId }) => {
    setUploadWorkspace(workspace);
    setUploadProject(projectId);
    setUploadFolderId(null);
    setUploadFolderLabel('');
    setUploadNewFolderName('');
    applyDefaultsToStaged(projectId, null, '', '', '');
    if (projectId && stagedFiles.length > 0) {
      const refs = await fetchNextFinanceReferences(projectId, stagedFiles.length);
      setStagedFiles((prev) => prev.map((f, i) => ({ ...f, referenceNumber: refs[i] || f.referenceNumber })));
    }
  };

  const handleFolderChange = ({ folderId, folderLabel, newFolderName }) => {
    setUploadFolderId(folderId);
    setUploadFolderLabel(folderLabel);
    setUploadNewFolderName(newFolderName || '');
    applyDefaultsToStaged(uploadProject, folderId, folderLabel, newFolderName);
  };

  const updateStagedFile = (id, field, value) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const updateOcrField = (id, field, value) => {
    setStagedFiles((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        ocrMetadata: { ...(f.ocrMetadata || emptyOcrMetadata()), [field]: value },
      };
    }));
  };

  const removeStagedFile = (id) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const ensureFolder = async (projectId, folderName) => {
    const name = folderName.trim();
    const existing = projectFolders.find(
      (f) => f.folderName.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing._id;

    try {
      const res = await axios.post('/api/finance/folders', {
        folderName: name,
        project: projectId,
      });
      queryClient.invalidateQueries({ queryKey: ['finance-folders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      return res.data.data._id;
    } catch (err) {
      if (err.response?.status === 409) {
        const list = await axios.get(`/api/finance/folders?project=${projectId}`);
        const found = list.data?.data?.find(
          (f) => f.folderName.toLowerCase() === name.toLowerCase(),
        );
        if (found) return found._id;
      }
      throw err;
    }
  };

  const handleSubmit = async () => {
    if (stagedFiles.length === 0) return;
    setResolvingFolders(true);
    try {
      const folderCache = new Map();
      const documents = [];

      for (const file of stagedFiles) {
        let folderId = file.folderId || null;
        const project = file.project || uploadProject;

        if (file.newFolderName?.trim() && project) {
          const key = `${project}:${file.newFolderName.trim().toLowerCase()}`;
          if (!folderCache.has(key)) {
            folderCache.set(key, await ensureFolder(project, file.newFolderName.trim()));
          }
          folderId = folderCache.get(key);
        } else if (uploadNewFolderName?.trim() && project && !folderId) {
          const key = `${project}:${uploadNewFolderName.trim().toLowerCase()}`;
          if (!folderCache.has(key)) {
            folderCache.set(key, await ensureFolder(project, uploadNewFolderName.trim()));
          }
          folderId = folderCache.get(key);
        }

        const ocr = file.ocrMetadata || emptyOcrMetadata();
        documents.push({
          title: file.title,
          description: file.description || '',
          project,
          folderId,
          category: file.category,
          referenceNumber: file.referenceNumber || '',
          fileUrl: file.fileUrl,
          fileKey: file.fileKey,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType,
          metadata: {
            vendor: ocr.vendor || '',
            amount: Number(ocr.amount) || 0,
            tax: Number(ocr.tax) || 0,
            currency: ocr.currency || 'INR',
            date: ocr.date || null,
            detectedCategory: file.category,
          },
        });
      }

      await onBulkSubmit({ documents });
    } finally {
      setResolvingFolders(false);
    }
  };

  const contextHint = selectedProjectName
    ? `Filtered project: ${selectedProjectName}${currentFolder?.folderName ? ` › ${currentFolder.folderName}` : ''}`
    : 'No project filter — pick project in step 2';

  const acceptTypes = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.xls,.xlsx,.csv,.doc,.docx';

  const pickFiles = (fileList) => {
    if (!fileList?.length || isUploading) return;
    onFilesSelected(fileList, uploadProject, defaultReferenceNumber);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e) => pickFiles(e.target.files);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    pickFiles(e.dataTransfer.files);
  };

  const dropZoneClass = `w-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-colors ${
    isDragOver
      ? 'border-blue-500 bg-blue-500/10'
      : 'border-[var(--color-bg-border)] hover:border-blue-500/50 bg-[var(--color-bg-workspace)]'
  } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

  const canGoStep2 = stagedFiles.length > 0 && !isUploading;
  const canGoStep3 = uploadProject && stagedFiles.every((f) => f.title && (f.project || uploadProject));
  const anyOcrParsing = stagedFiles.some((f) => f.ocrStatus === 'parsing');

  const handleClose = () => {
    if (!isUploading && !isSubmitting) onClose();
  };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} size="xl" widthPx={896} zIndex={1000}>
      <ModalHeader title="Upload Finance Documents" onClose={handleClose} icon={Upload} />
      <ModalBody className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <StepIndicator step={step} />
          <p className="text-[10px] text-[var(--color-text-muted)]">{contextHint}</p>
        </div>

        {/* Step 1 — upload only */}
        {step === 1 && (
          <>
            {stagedFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{stagedFiles.length} file(s) ready</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1.5"
                  >
                    <Upload size={14} /> Add more
                  </button>
                </div>
                <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {stagedFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-3 p-3 border border-[var(--color-bg-border)] rounded-xl bg-[var(--color-bg-surface)]"
                    >
                      <FileText size={18} className="text-blue-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{file.fileName}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{formatBytes(file.fileSize)}</p>
                      </div>
                      <button type="button" onClick={() => removeStagedFile(file.id)} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={dropZoneClass}
              >
                <Upload size={36} className={`mb-3 ${isDragOver ? 'text-blue-500' : 'text-[var(--color-text-muted)]'}`} />
                <p className="text-sm font-bold text-blue-500">Drag & drop files here or click to browse</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">PDF, images, spreadsheets — up to 32MB each</p>
              </div>
            )}

            {isUploading && (
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-500">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={14} className="animate-spin" /> Uploading…
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <FinanceUploadProgressBar progress={uploadProgress} />
              </div>
            )}
          </>
        )}

        {/* Step 2 — basic details + background OCR */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] space-y-4">
              <WorkspaceProjectFields
                projects={projects}
                workspace={uploadWorkspace}
                projectId={uploadProject}
                onChange={handleProjectChange}
                layout="inline"
              />
              <FolderCombobox
                projectId={uploadProject}
                folders={projectFolders}
                value={uploadFolderId || ROOT_FOLDER_VALUE}
                folderLabel={uploadFolderLabel}
                onChange={handleFolderChange}
                disabled={!uploadProject}
              />
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                  Reference #
                </label>
                <input
                  type="text"
                  value={defaultReferenceNumber}
                  disabled={!uploadProject || loadingReference}
                  placeholder={loadingReference ? 'Generating…' : 'e.g. TSCCO-HM-001'}
                  onChange={(e) => {
                    setDefaultReferenceNumber(e.target.value);
                    applyDefaultsToStaged(uploadProject, uploadFolderId, uploadFolderLabel, uploadNewFolderName, e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                />
              </div>
            </div>

            <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5">
              {anyOcrParsing ? (
                <><Loader2 size={12} className="animate-spin text-blue-500" /> OCR running in background…</>
              ) : (
                <><Check size={12} className="text-emerald-500" /> OCR will pre-fill review on next step</>
              )}
            </p>

            <div className="space-y-3 max-h-[36vh] overflow-y-auto">
              {stagedFiles.map((file) => (
                <div key={file.id} className="p-4 border border-[var(--color-bg-border)] rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" />
                    <span className="text-xs font-bold truncate flex-1">{file.fileName}</span>
                    <FinanceUploadStateBadge
                      state={file.ocrStatus === 'parsing' ? FINANCE_UPLOAD_STATES.PARSING : FINANCE_UPLOAD_STATES.UPLOADING}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Title *</label>
                      <input
                        type="text"
                        value={file.title}
                        onChange={(e) => updateStagedFile(file.id, 'title', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Category</label>
                      <select
                        value={file.category}
                        onChange={(e) => updateStagedFile(file.id, 'category', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Reference #</label>
                      <input
                        type="text"
                        value={file.referenceNumber || ''}
                        onChange={(e) => updateStagedFile(file.id, 'referenceNumber', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — OCR review */}
        {step === 3 && (
          <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
            {stagedFiles.map((file) => {
              const ocr = file.ocrMetadata || emptyOcrMetadata();
              return (
                <div key={file.id} className="p-4 border border-[var(--color-bg-border)] rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{file.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{file.fileName}</p>
                    </div>
                    {file.ocrStatus === 'parsing' && (
                      <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Parsing…
                      </span>
                    )}
                  </div>

                  {isFinancePdf(file) && (
                    <FinanceDocumentPreview
                      doc={file}
                      iframeClassName="w-full h-40 rounded-lg border border-[var(--color-bg-border)] bg-slate-900"
                      className="w-full h-40 rounded-lg border border-[var(--color-bg-border)] bg-slate-900"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Vendor</label>
                      <input
                        type="text"
                        value={ocr.vendor}
                        onChange={(e) => updateOcrField(file.id, 'vendor', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Amount (INR)</label>
                      <input
                        type="number"
                        value={ocr.amount}
                        onChange={(e) => updateOcrField(file.id, 'amount', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Tax</label>
                      <input
                        type="number"
                        value={ocr.tax}
                        onChange={(e) => updateOcrField(file.id, 'tax', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Payment date</label>
                      <input
                        type="date"
                        value={ocr.date}
                        onChange={(e) => updateOcrField(file.id, 'date', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Currency</label>
                      <select
                        value={normalizeFinanceCurrency(ocr.currency)}
                        onChange={(e) => updateOcrField(file.id, 'currency', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      >
                        {FINANCE_CURRENCY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          accept={acceptTypes}
          className="hidden"
        />
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          disabled={isUploading || resolvingFolders || isSubmitting}
          onClick={handleClose}
          className="px-4 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-border)] rounded-xl disabled:opacity-40"
        >
          Cancel
        </button>

        {step > 1 && (
          <button
            type="button"
            disabled={isUploading || isSubmitting}
            onClick={() => setStep((s) => s - 1)}
            className="px-4 py-2 text-xs font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] rounded-xl"
          >
            Back
          </button>
        )}

        {step === 1 && (
          <button
            type="button"
            disabled={!canGoStep2}
            onClick={() => setStep(2)}
            className="px-5 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-xl disabled:opacity-50"
          >
            Next — details
          </button>
        )}

        {step === 2 && (
          <button
            type="button"
            disabled={!canGoStep3}
            onClick={() => setStep(3)}
            className="px-5 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-xl disabled:opacity-50"
          >
            Next — review OCR
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              stagedFiles.length === 0
              || !uploadProject
              || isUploading
              || isSubmitting
              || resolvingFolders
            }
            className="px-5 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-xl disabled:opacity-50"
          >
            {resolvingFolders
              ? 'Creating folders…'
              : isSubmitting
                ? 'Saving…'
                : `Save ${stagedFiles.length} document${stagedFiles.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </ModalFooter>
    </ModalShell>
  );
};

export default UploadDocumentModal;
