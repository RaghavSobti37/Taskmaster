import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Upload, X, FileText, Loader2, FolderOpen, FolderPlus, ChevronDown } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/ModalShell';
import WorkspaceProjectFields, { filterProjectsByWorkspace } from '../forms/WorkspaceProjectFields';

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

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

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
    (f) => f.folderName.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreateOption =
    trimmed.length > 0 && !matchingFolder && projectId;

  const options = useMemo(() => {
    const list = [
      { id: ROOT_FOLDER_VALUE, label: 'Project root (no folder)', isRoot: true },
      ...folders.map((f) => ({ id: f._id, label: f.folderName, isRoot: false })),
    ];
    if (!trimmed) return list;
    return list.filter((o) =>
      o.isRoot ? 'root'.includes(trimmed.toLowerCase())
        : o.label.toLowerCase().includes(trimmed.toLowerCase())
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
                (f) => f.folderName.toLowerCase() === e.target.value.trim().toLowerCase()
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

  const [uploadWorkspace, setUploadWorkspace] = useState('General');
  const [uploadProject, setUploadProject] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [uploadFolderLabel, setUploadFolderLabel] = useState('');
  const [uploadNewFolderName, setUploadNewFolderName] = useState('');
  const [resolvingFolders, setResolvingFolders] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initialProject = selectedProject || '';
    const initialProjectRecord = projects.find((p) => p._id === initialProject);
    setUploadWorkspace(initialProjectRecord?.workspace || 'General');
    setUploadProject(initialProject);
    setUploadFolderId(currentFolderId || null);
    setUploadFolderLabel(currentFolder?.folderName || '');
    setUploadNewFolderName('');
  }, [isOpen, selectedProject, currentFolderId, currentFolder?.folderName, projects]);

  const { data: foldersRes } = useQuery({
    queryKey: ['finance-folders', uploadProject],
    queryFn: async () => {
      if (!uploadProject) return { data: [] };
      return (await axios.get(`/api/finance/folders?project=${uploadProject}`)).data;
    },
    enabled: isOpen && !!uploadProject,
  });

  const projectFolders = foldersRes?.data || [];

  const applyDefaultsToStaged = (project, folderId, folderLabel, newFolderName) => {
    setStagedFiles((prev) =>
      prev.map((f) => ({
        ...f,
        project: project || f.project,
        folderId: folderId ?? null,
        folderLabel: folderLabel || '',
        newFolderName: newFolderName || '',
      }))
    );
  };

  const handleProjectChange = ({ workspace, projectId }) => {
    setUploadWorkspace(workspace);
    setUploadProject(projectId);
    setUploadFolderId(null);
    setUploadFolderLabel('');
    setUploadNewFolderName('');
    applyDefaultsToStaged(projectId, null, '', '');
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

  const removeStagedFile = (id) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const ensureFolder = async (projectId, folderName) => {
    const name = folderName.trim();
    const existing = projectFolders.find(
      (f) => f.folderName.toLowerCase() === name.toLowerCase()
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
          (f) => f.folderName.toLowerCase() === name.toLowerCase()
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

        documents.push({
          title: file.title,
          description: file.description || '',
          project,
          folderId,
          category: file.category,
          fileUrl: file.fileUrl,
          fileKey: file.fileKey,
          fileName: file.fileName,
          fileSize: file.fileSize,
          fileType: file.fileType,
        });
      }

      await onBulkSubmit({ documents });
    } finally {
      setResolvingFolders(false);
    }
  };

  const contextHint = selectedProjectName
    ? `Filtered project: ${selectedProjectName}${currentFolder?.folderName ? ` › ${currentFolder.folderName}` : ''}`
    : 'No project filter — pick project & folder below';

  const acceptTypes = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.xls,.xlsx,.csv,.doc,.docx';

  const pickFiles = (fileList) => {
    if (!fileList?.length || isUploading || !uploadProject) return;
    onFilesSelected(fileList);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e) => pickFiles(e.target.files);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && uploadProject) setIsDragOver(true);
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
    if (!uploadProject) return;
    pickFiles(e.dataTransfer.files);
  };

  const dropZoneClass = `w-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-colors ${
    isDragOver
      ? 'border-blue-500 bg-blue-500/10'
      : 'border-[var(--color-bg-border)] hover:border-blue-500/50 bg-[var(--color-bg-workspace)]'
  } ${isUploading || !uploadProject ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="xl" widthPx={896} zIndex={1000}>
      <ModalHeader title="Upload Finance Documents" onClose={onClose} icon={Upload} />
      <ModalBody className="space-y-4">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          {contextHint}. Defaults apply to all staged files.
        </p>

        {/* Global project + folder */}
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
        </div>

        {stagedFiles.length > 0 ? (
          <div
            className="space-y-4"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} staged
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Upload size={14} /> Add more
              </button>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {stagedFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-4 border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] rounded-xl relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => removeStagedFile(file.id)}
                    className="absolute top-3 right-3 p-1 hover:bg-red-500/10 rounded text-red-500"
                  >
                    <X size={14} />
                  </button>

                  <div className="flex items-center gap-3 pr-8">
                    <FileText size={20} className="text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{file.fileName}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{formatBytes(file.fileSize)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={file.title}
                        onChange={(e) => updateStagedFile(file.id, 'title', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                        Project
                      </label>
                      <select
                        value={file.project || uploadProject}
                        onChange={(e) => {
                          const pid = e.target.value;
                          updateStagedFile(file.id, 'project', pid);
                          const project = projects.find((p) => p._id === pid);
                          if (project?.workspace) setUploadWorkspace(project.workspace);
                        }}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm cursor-pointer"
                      >
                        <option value="">Select project</option>
                        {filterProjectsByWorkspace(projects, uploadWorkspace).map((p) => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                        Category
                      </label>
                      <select
                        value={file.category}
                        onChange={(e) => updateStagedFile(file.id, 'category', e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-sm cursor-pointer"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {(file.newFolderName || file.folderLabel) && (
                      <div className="sm:col-span-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <FolderOpen size={12} />
                        {file.newFolderName
                          ? `New folder: ${file.newFolderName}`
                          : file.folderLabel || 'Project root'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isUploading && uploadProject && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={dropZoneClass}
          >
            <Upload size={36} className={`mb-3 ${isDragOver ? 'text-blue-500' : 'text-[var(--color-text-muted)]'}`} />
            <p className="text-sm font-bold text-blue-500">
              {uploadProject ? 'Drag & drop files here or click to browse' : 'Select a project above first'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Multiple files supported — PDF, images, spreadsheets — up to 32MB each
            </p>
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

        {isUploading && (
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-500">
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Uploading…
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-[var(--color-bg-border)] h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          disabled={isUploading || resolvingFolders}
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-border)] rounded-xl disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            stagedFiles.length === 0
            || stagedFiles.some((f) => !f.title || !(f.project || uploadProject))
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
              ? 'Saving & parsing…'
              : `Save ${stagedFiles.length} document${stagedFiles.length !== 1 ? 's' : ''}`}
        </button>
      </ModalFooter>
    </ModalShell>
  );
};

export default UploadDocumentModal;
