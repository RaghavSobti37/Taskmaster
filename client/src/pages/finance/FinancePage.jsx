import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Trash2, Download,
  FolderOpen, X, ChevronDown, File,
  FileSpreadsheet, Image as ImageIcon,
  Calendar, ChevronLeft, ChevronRight, Info, Check, Eye, ArrowLeft, ArrowUp, ArrowDown,
  FolderPlus,
} from 'lucide-react';
import { uploadFinanceFiles } from '../../utils/financeUpload';
import UploadDocumentModal from '../../components/finance/UploadDocumentModal';
import UsdInrAmountFields from '../../components/finance/UsdInrAmountFields';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { inrToUsd } from '../../utils/usdInr';
import {
  PageContainer,
  PageHeader,
  Button,
  SearchInput,
  EmptyState,
  IconButton,
  CenteredModal,
  TablePagination,
} from '../../components/ui';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatProjectName, normalizeProjects, normalizePopulatedProjectList } from '../../utils/projectUtils';

const CATEGORIES = [
  { value: 'all', label: 'All Types' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'budget', label: 'Budget' },
  { value: 'report', label: 'Report' },
  { value: 'tax', label: 'Tax' },
  { value: 'other', label: 'Other' },
];

const CAT_COLORS = {
  invoice: { bg: '#E6F4EA', text: '#137333', darkBg: '#0F2916', darkText: '#81C995' }, // Success
  receipt: { bg: '#F1F3F4', text: '#3C4043', darkBg: '#202124', darkText: '#BDC1C6' }, // Info
  contract: { bg: '#E6F4EA', text: '#137333', darkBg: '#0F2916', darkText: '#81C995' }, // Success
  proposal: { bg: '#FEF7E0', text: '#B06000', darkBg: '#2E2003', darkText: '#FDD663' }, // Warning
  budget: { bg: '#FEF7E0', text: '#B06000', darkBg: '#2E2003', darkText: '#FDD663' }, // Warning
  report: { bg: '#F1F3F4', text: '#3C4043', darkBg: '#202124', darkText: '#BDC1C6' }, // Info
  tax: { bg: '#FCE8E6', text: '#C5221F', darkBg: '#30100F', darkText: '#F28B82' }, // Danger
  other: { bg: '#F1F3F4', text: '#3C4043', darkBg: '#202124', darkText: '#BDC1C6' }, // Info
};

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const formatDocDate = (doc) => {
  const raw = doc?.metadata?.date;
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SortableTh = ({ label, field, sortConfig, onSort }) => (
  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
    >
      {label}
      {sortConfig.field === field && (
        sortConfig.order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      )}
    </button>
  </th>
);

const getFileIcon = (type) => {
  if (!type) return File;
  if (type.includes('pdf')) return FileText;
  if (type.includes('sheet') || type.includes('csv') || type.includes('excel')) return FileSpreadsheet;
  if (type.includes('image')) return ImageIcon;
  return File;
};

const InfoTooltip = ({ content }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-0.5 inline-flex items-center"
      >
        <Info size={12} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-slate-100 text-[10px] rounded-lg shadow-xl pointer-events-none"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FinancePage = () => {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folderId') || '';

  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderProject, setNewFolderProject] = useState('');

  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ field: 'docDate', order: 'desc' });

  const [stagedFiles, setStagedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Selected document for Workspace Preview Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editAmountUsd, setEditAmountUsd] = useState('');

  const { data: rateData } = useUsdInrRate({ enabled: !!selectedDoc });
  const usdInrRate = rateData?.rate;

  useEffect(() => {
    if (selectedDoc) {
      setEditForm({
        title: selectedDoc.title || '',
        description: selectedDoc.description || '',
        project: selectedDoc.project?._id || selectedDoc.project || '',
        category: selectedDoc.category || 'other',
        metadata: {
          vendor: selectedDoc.metadata?.vendor || '',
          amount: selectedDoc.metadata?.amount || 0,
          currency: selectedDoc.metadata?.currency || 'INR',
          tax: selectedDoc.metadata?.tax || 0,
          date: selectedDoc.metadata?.date ? new Date(selectedDoc.metadata.date).toISOString().split('T')[0] : ''
        }
      });
      setEditAmountUsd('');
    } else {
      setEditForm(null);
      setEditAmountUsd('');
    }
  }, [selectedDoc?._id]);

  useEffect(() => {
    if (!selectedDoc || !editForm?.metadata?.amount) return;
    if (!Number.isFinite(usdInrRate) || usdInrRate <= 0) return;
    setEditAmountUsd((prev) => (prev === '' ? String(inrToUsd(editForm.metadata.amount, usdInrRate)) : prev));
  }, [selectedDoc?._id, usdInrRate, editForm?.metadata?.amount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, selectedCategory, searchQuery, startDate, endDate, currentFolderId, pageSize, sortConfig.field, sortConfig.order]);

  const toggleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        if (prev.order === 'asc') return { field, order: 'desc' };
        if (prev.order === 'desc') return { field: null, order: 'asc' };
      }
      return { field, order: 'asc' };
    });
  };

  const navigateToFolder = (folderId) => {
    const next = new URLSearchParams(searchParams);
    if (folderId) next.set('folderId', folderId);
    else next.delete('folderId');
    setSearchParams(next);
    setCurrentPage(1);
  };

  const goToProjectRoot = () => navigateToFolder(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedDoc) {
        setSelectedDoc(null);
        return;
      }
      if (currentFolderId) goToProjectRoot();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFolderId, selectedDoc, searchParams]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => normalizeProjects((await axios.get('/api/projects')).data),
  });

  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['finance-docs', selectedProject, selectedCategory, startDate, endDate, searchQuery, currentPage, pageSize, currentFolderId, sortConfig.field, sortConfig.order],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProject) params.set('project', selectedProject);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (searchQuery) params.set('searchQuery', searchQuery);
      if (currentFolderId) params.set('folderId', currentFolderId);
      if (sortConfig.field) {
        params.set('sortField', sortConfig.field);
        params.set('sortOrder', sortConfig.order);
      }
      params.set('page', currentPage);
      params.set('limit', pageSize);
      const res = (await axios.get(`/api/finance?${params}`)).data;
      if (res?.data) {
        res.data = normalizePopulatedProjectList(res.data);
      }
      if (res?.currentFolder?.project) {
        res.currentFolder = {
          ...res.currentFolder,
          project: typeof res.currentFolder.project === 'object'
            ? { ...res.currentFolder.project, name: formatProjectName(res.currentFolder.project.name) }
            : res.currentFolder.project,
        };
      }
      return res;
    },
  });

  const { data: foldersRes } = useQuery({
    queryKey: ['finance-folders', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return { data: [] };
      return (await axios.get(`/api/finance/folders?project=${selectedProject}`)).data;
    },
    enabled: !!selectedProject,
  });

  const { data: breadcrumbRes } = useQuery({
    queryKey: ['finance-breadcrumb', currentFolderId],
    queryFn: async () => (await axios.get(`/api/finance/folders/${currentFolderId}/breadcrumb`)).data,
    enabled: !!currentFolderId,
  });

  const docs = docsRes?.data || [];
  const pagination = docsRes?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };
  const projectFolders = foldersRes?.data || [];
  const breadcrumb = breadcrumbRes?.data || [];

  const activeFolder = useMemo(() => {
    if (docsRes?.currentFolder) return docsRes.currentFolder;
    if (currentFolderId && breadcrumb.length > 0) {
      const last = breadcrumb[breadcrumb.length - 1];
      return { _id: last._id, folderName: last.folderName, project: last.project };
    }
    if (currentFolderId) {
      const f = projectFolders.find((pf) => pf._id === currentFolderId);
      if (f) return { _id: f._id, folderName: f.folderName, project: f.project };
    }
    return null;
  }, [docsRes?.currentFolder, currentFolderId, breadcrumb, projectFolders]);

  useEffect(() => {
    if (activeFolder?.project?._id && selectedProject !== activeFolder.project._id) {
      setSelectedProject(activeFolder.project._id);
    }
  }, [activeFolder?._id, activeFolder?.project?._id]);

  const selectedProjectName = formatProjectName(projects.find((p) => p._id === selectedProject)?.name || '');
  const folderPathLabel = activeFolder
    ? `${selectedProjectName} › ${activeFolder.folderName}`
    : selectedProjectName || null;

  const openNewFolderModal = () => {
    const projectId =
      selectedProject
      || activeFolder?.project?._id
      || activeFolder?.project
      || '';
    setNewFolderProject(projectId);
    setNewFolderName('');
    setShowNewFolder(true);
  };

  const newFolderProjectName = projects.find((p) => p._id === newFolderProject)?.name || '';

  const createFolderMutation = useMutation({
    mutationFn: (payload) => axios.post('/api/finance/folders', payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      queryClient.invalidateQueries({ queryKey: ['finance-folders'] });
      if (variables.project && !selectedProject) {
        setSelectedProject(variables.project);
        goToProjectRoot();
      }
      setShowNewFolder(false);
      setNewFolderName('');
      setNewFolderProject('');
    },
  });

  const folderToolbar = currentFolderId ? (
    <div className="px-4 py-2.5 bg-amber-500/10 border-b border-[var(--color-bg-border)] flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={goToProjectRoot}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-[var(--color-bg-surface)] text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors shrink-0"
      >
        <ArrowLeft size={14} />
        Back to {selectedProjectName || 'project'}
      </button>
      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 min-w-0">
        <FolderOpen size={14} className="shrink-0" />
        <span className="truncate">Viewing folder: {activeFolder?.folderName || 'Folder'}</span>
      </span>
     
    </div>
  ) : null;

  const tableBreadcrumb = (selectedProject || currentFolderId) ? (
    <nav className="px-4 py-3 border-b border-[var(--color-bg-border)] flex flex-wrap items-center gap-1 text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-surface)]">
      <button
        type="button"
        onClick={() => { setSelectedProject(''); goToProjectRoot(); }}
        className="hover:text-blue-500 transition-colors"
      >
        Finance
      </button>
      {selectedProject && (
        <>
          <ChevronRight size={12} className="opacity-50" />
          <button
            type="button"
            onClick={goToProjectRoot}
            className={`hover:text-blue-500 transition-colors ${!currentFolderId ? 'text-[var(--color-text-primary)]' : ''}`}
          >
            {selectedProjectName}
          </button>
        </>
      )}
      {breadcrumb.map((crumb) => (
        <React.Fragment key={crumb._id}>
          <ChevronRight size={12} className="opacity-50" />
          <button
            type="button"
            onClick={() => navigateToFolder(crumb._id)}
            className={`hover:text-blue-500 transition-colors ${currentFolderId === crumb._id ? 'text-[var(--color-text-primary)]' : ''}`}
          >
            {crumb.folderName}
          </button>
        </React.Fragment>
      ))}
      {!currentFolderId && (
        <button
          type="button"
          onClick={openNewFolderModal}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-bg-border)] text-[10px] font-black uppercase tracking-wider text-[var(--color-text-primary)] hover:bg-[var(--color-bg-border)] transition-colors"
        >
          <FolderPlus size={12} />
          New Folder
        </button>
      )}
    </nav>
  ) : null;

  const bulkCreateMutation = useMutation({
    mutationFn: (payload) => axios.post('/api/finance/bulk', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      setShowUpload(false);
      setStagedFiles([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => axios.patch(`/api/finance/${id}`, payload, {
      headers: { 'x-skip-toast': 'true' }
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      if (res?.data?.data) setSelectedDoc(res.data.data);
    },
    onError: (err) => {
      const message = err.response?.data?.message || err.message || 'Failed to save document';
      alert(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/finance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      setSelectedDoc(null);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId) => axios.delete(`/api/finance/folders/${folderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      queryClient.invalidateQueries({ queryKey: ['finance-folders'] });
    },
  });

  const handleDeleteFolder = async (e, folder) => {
    e.stopPropagation();
    const count = folder.documentCount ?? 0;
    const message = count > 0
      ? `Delete folder "${folder.folderName}" and all ${count} document(s) inside?`
      : `Delete folder "${folder.folderName}"?`;
    const ok = await confirm({
      title: 'Delete folder?',
      message,
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (ok) deleteFolderMutation.mutate(folder._id);
  };

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadFinanceFiles(files, {
        onProgress: (pct) => setUploadProgress(pct),
      });

      if (uploaded.length > 0) {
        const baseId = Date.now();
        const newStaged = uploaded.map((item, index) => ({
          id: `${baseId}-${index}`,
          title: item.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim(),
          description: '',
          project: selectedProject || (projects[0]?._id || ''),
          folderId: currentFolderId || null,
          folderLabel: activeFolder?.folderName || '',
          newFolderName: '',
          category: 'invoice',
          fileUrl: item.url,
          fileKey: item.key,
          fileName: item.name,
          fileSize: item.size,
          fileType: files[index]?.type || item.type || item.name?.split('.').pop(),
        }));
        setStagedFiles((prev) => [...prev, ...newStaged]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
      if (err.partial && err.uploaded?.length) {
        const baseId = Date.now();
        const newStaged = err.uploaded.map((item, index) => ({
          id: `${baseId}-${index}`,
          title: item.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim(),
          description: '',
          project: selectedProject || (projects[0]?._id || ''),
          folderId: currentFolderId || null,
          folderLabel: activeFolder?.folderName || '',
          newFolderName: '',
          category: 'invoice',
          fileUrl: item.url,
          fileKey: item.key,
          fileName: item.name,
          fileSize: item.size,
          fileType: item.type,
        }));
        setStagedFiles((prev) => [...prev, ...newStaged]);
        alert(err.message);
      } else {
        alert('Upload failed: ' + (err.response?.data?.message || err.message || 'Unknown error'));
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleBulkSubmit = async ({ documents }) => {
    if (!documents?.length) return;
    bulkCreateMutation.mutate({ documents });
  };

  return (
    <PageContainer maxWidth="1400px" className="!py-4 !space-y-6">
      <PageHeader
        icon={FileText}
        title="Finance Documents"
        subtitle="Manage project invoices, contracts, and financial records"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={openNewFolderModal}>
              <FolderPlus size={16} /> New Folder
            </Button>
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Upload size={16} /> Upload Documents
            </Button>
          </>
        }
      />

      {/* Filters & Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchInput
          placeholder="Search title, file name, vendor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-[240px] flex-1"
        />

        {/* Project Select */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              goToProjectRoot();
            }}
            className="appearance-none pl-3 pr-8 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>

        {/* Category Select */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-1">
          <Calendar size={14} className="text-[var(--color-text-muted)]" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
          />
          <span className="text-[var(--color-text-muted)] text-[10px]">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
          />
          {(startDate || endDate) && (
            <IconButton icon={X} label="Clear dates" size="sm" onClick={() => { setStartDate(''); setEndDate(''); }} />
          )}
        </div>

      </div>

      {/* Documents Table */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl overflow-hidden shadow-sm">
        {tableBreadcrumb}
        {folderToolbar}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">Loading documents...</div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={currentFolderId ? `No documents in ${activeFolder?.folderName || 'this folder'}` : 'No documents found'}
            description={currentFolderId ? 'Upload documents into this folder' : 'Select a project or upload documents'}
            actionLabel={currentFolderId ? `Back to ${selectedProjectName || 'project'}` : undefined}
            onAction={currentFolderId ? goToProjectRoot : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]">
                  <SortableTh label="Name" field="title" sortConfig={sortConfig} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Project</th>
                  <SortableTh label="Category" field="category" sortConfig={sortConfig} onSort={toggleSort} />
                  <SortableTh label="Size" field="fileSize" sortConfig={sortConfig} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Uploaded By</th>
                  <SortableTh label="Doc Date" field="docDate" sortConfig={sortConfig} onSort={toggleSort} />
                  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, index) => {
                  const prev = docs[index - 1];
                  const showRootDivider =
                    !currentFolderId
                    && selectedProject
                    && !doc.isFolder
                    && prev?.isFolder;

                  if (doc.isFolder) {
                    return (
                      <motion.tr
                        key={doc._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-[var(--color-bg-border)] last:border-0 hover:bg-amber-500/5 transition-colors cursor-pointer group"
                        onClick={() => {
                          if (!selectedProject && doc.project?._id) setSelectedProject(doc.project._id);
                          navigateToFolder(doc._id);
                        }}
                      >
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-[var(--color-text-secondary)]">
                            {formatProjectName(doc.project?.name) || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            Folder
                          </span>
                        </td>
                        <td colSpan={3} className="px-4 py-3" />
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFolder(e, doc)}
                              disabled={deleteFolderMutation.isPending}
                              className="p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
                              title="Delete folder"
                            >
                              <Trash2 size={14} />
                            </button>
                            <ChevronRight size={16} className="text-[var(--color-text-muted)] group-hover:text-amber-500" />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  }

                  const FileIcon = getFileIcon(doc.fileType);
                  const cat = CAT_COLORS[doc.category] || CAT_COLORS.other;
                  const isImage = doc.fileType?.includes('image') || /\.(png|jpe?g|webp)$/i.test(doc.fileName);

                  return (
                    <React.Fragment key={doc._id}>
                      {showRootDivider && (
                        <tr className="bg-[var(--color-bg-workspace)]">
                          <td colSpan={7} className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                            Documents at project root
                          </td>
                        </tr>
                      )}
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-[var(--color-bg-border)] last:border-0 hover:bg-slate-100/75 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            {isImage ? (
                              <img src={doc.fileUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-[var(--color-bg-border)] flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-bg-workspace)] flex-shrink-0 border border-[var(--color-bg-border)]">
                                <FileIcon size={16} className="text-[var(--color-text-muted)]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[var(--color-text-primary)] group-hover:text-blue-500 transition-colors truncate max-w-[280px]">{doc.title}</p>
                              {doc.fileName && <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[200px]">{doc.fileName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs font-bold text-[var(--color-text-secondary)]">{doc.project?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider" style={{ background: cat.bg, color: cat.text }}>
                            {doc.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{formatBytes(doc.fileSize)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {doc.uploadedBy?.avatar ? (
                              <img src={doc.uploadedBy.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[8px] font-bold text-blue-500">
                                {doc.uploadedBy?.name?.[0]}
                              </div>
                            )}
                            <span className="text-[10px] font-bold text-[var(--color-text-secondary)] truncate max-w-[120px]">{doc.uploadedBy?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
                          {formatDocDate(doc)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); }}
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
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await confirm({
                                  title: 'Delete document?',
                                  message: 'Delete document?',
                                  confirmLabel: 'Delete',
                                  type: 'danger',
                                });
                                if (ok) deleteMutation.mutate(doc._id);
                              }}
                              className="p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && pagination.total > 0 && (
          <TablePagination
            pageSize={pageSize}
            currentPage={currentPage}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            rowCount={docs.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      <UploadDocumentModal
        isOpen={showUpload}
        onClose={() => { if (!isUploading) setShowUpload(false); }}
        stagedFiles={stagedFiles}
        setStagedFiles={setStagedFiles}
        projects={projects}
        selectedProject={selectedProject}
        selectedProjectName={selectedProjectName}
        currentFolderId={currentFolderId}
        currentFolder={activeFolder}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onFilesSelected={handleFilesSelected}
        onBulkSubmit={handleBulkSubmit}
        isSubmitting={bulkCreateMutation.isPending}
      />

      <CenteredModal isOpen={showNewFolder} onClose={() => setShowNewFolder(false)} size="md" zIndex={1001}>
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-bold">Create folder</h3>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Folders live at project root{newFolderProjectName ? ` — ${newFolderProjectName}` : ''}.
          </p>
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Project *</label>
            <select
              value={newFolderProject}
              onChange={(e) => setNewFolderProject(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Folder name *</label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. April 2026"
              className="w-full px-3 py-2 border border-[var(--color-bg-border)] rounded-xl text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim() && newFolderProject) {
                  createFolderMutation.mutate({ folderName: newFolderName.trim(), project: newFolderProject });
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowNewFolder(false)} className="px-4 py-2 text-xs font-bold text-[var(--color-text-muted)]">Cancel</button>
            <button
              type="button"
              disabled={!newFolderName.trim() || !newFolderProject || createFolderMutation.isPending}
              onClick={() => createFolderMutation.mutate({ folderName: newFolderName.trim(), project: newFolderProject })}
              className="px-4 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-xl disabled:opacity-50"
            >
              {createFolderMutation.isPending ? 'Creating…' : 'Create folder'}
            </button>
          </div>
        </div>
      </CenteredModal>

      {/* FullScreenWorkspace Immersive Preview Modal (70% Preview, 30% Metadata) */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-end"
          >
            {/* Modal Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-full bg-[var(--color-bg-surface)] border-l border-[var(--color-bg-border)] flex flex-col md:flex-row shadow-2xl overflow-hidden"
            >
              {/* Document Preview (70% Left Side) */}
              <div className="flex-1 bg-slate-950 flex flex-col relative h-[50vh] md:h-full">
                {/* Top Navbar for Left Side */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center gap-3 shrink-0 z-10">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all text-xs font-bold"
                    title="Close Preview (Esc)"
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>
                  <span className="text-[10px] font-bold text-slate-300 truncate max-w-[320px]">
                    {selectedDoc.fileName}
                  </span>
                </div>

                {/* Viewer Render */}
                <div className="w-full h-full flex items-center justify-center p-6">
                  {selectedDoc.fileType?.includes('pdf') ? (
                    <iframe
                      src={selectedDoc.fileUrl}
                      title={selectedDoc.title}
                      className="w-full h-full rounded-xl border border-slate-800 shadow-2xl bg-slate-900"
                    />
                  ) : selectedDoc.fileType?.includes('image') || /\.(png|jpe?g|webp)$/i.test(selectedDoc.fileName) ? (
                    <img
                      src={selectedDoc.fileUrl}
                      alt={selectedDoc.title}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800"
                    />
                  ) : (
                    <div className="text-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl max-w-sm">
                      <FileText size={48} className="mx-auto text-slate-500 mb-3" />
                      <p className="text-sm font-bold text-slate-300">Preview not supported</p>
                      <p className="text-xs text-slate-500 mt-1">Download the document to view its contents.</p>
                      <a
                        href={selectedDoc.fileUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download size={14} /> Download File
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Metadata Panel (30% Right Side) */}
              <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-[var(--color-bg-border)] h-[50vh] md:h-full flex flex-col bg-[var(--color-bg-surface)]">
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Document details</h3>
                    <p className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-[280px]">{selectedDoc.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-secondary)] transition-colors"
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete document?',
                          message: 'Are you sure you want to delete this document?',
                          confirmLabel: 'Delete',
                          type: 'danger',
                        });
                        if (ok) deleteMutation.mutate(selectedDoc._id);
                      }}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setSelectedDoc(null)}
                      className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-secondary)] transition-colors md:hidden"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {/* Edit Form */}
                {editForm && (
                  <div className="p-4 overflow-y-auto flex-1 space-y-4 text-left">
                    {/* Document Fields */}
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Title *</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        onBlur={() => updateMutation.mutate({ id: selectedDoc._id, payload: { title: editForm.title } })}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        onBlur={() => updateMutation.mutate({ id: selectedDoc._id, payload: { description: editForm.description } })}
                        placeholder="Add brief details..."
                        rows={2}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Project</label>
                        <select
                          value={editForm.project}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditForm(prev => ({ ...prev, project: val }));
                            updateMutation.mutate({ id: selectedDoc._id, payload: { project: val || null } });
                          }}
                          className="w-full px-2 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
                        >
                          <option value="">No Project</option>
                          {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Category</label>
                        <select
                          value={editForm.category}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditForm(prev => ({ ...prev, category: val }));
                            updateMutation.mutate({ id: selectedDoc._id, payload: { category: val } });
                          }}
                          className="w-full px-2 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
                        >
                          {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* OCR Extractions (Display fields & updates) */}
                    <div className="p-3 bg-slate-100/60 dark:bg-slate-800/25 border border-[var(--color-bg-border)] rounded-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">OCR/OMR Extracted Metadata</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-0.5">
                          <Check size={10} /> Auto Extracted
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                            Vendor Name
                            <InfoTooltip content="Extracted Seller/Vendor letterhead name detected in invoice text." />
                          </label>
                          <input
                            type="text"
                            value={editForm.metadata?.vendor}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, vendor: e.target.value }
                            }))}
                            onBlur={() => updateMutation.mutate({
                              id: selectedDoc._id,
                              payload: { metadata: { ...selectedDoc.metadata, vendor: editForm.metadata.vendor } }
                            })}
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                      </div>

                      <UsdInrAmountFields
                        compact
                        enabled={!!selectedDoc}
                        inrLabel="Total Amount (INR)"
                        usdLabel="Amount (USD)"
                        inrValue={editForm.metadata?.amount === 0 || editForm.metadata?.amount === '' ? '' : String(editForm.metadata?.amount ?? '')}
                        usdValue={editAmountUsd}
                        onInrChange={(amount) => setEditForm((prev) => ({
                          ...prev,
                          metadata: { ...prev.metadata, amount, currency: 'INR' },
                        }))}
                        onUsdChange={setEditAmountUsd}
                        inrInputProps={{
                          onBlur: () => updateMutation.mutate({
                            id: selectedDoc._id,
                            payload: {
                              metadata: {
                                ...selectedDoc.metadata,
                                amount: parseFloat(editForm.metadata.amount) || 0,
                                currency: 'INR',
                              },
                            },
                          }),
                        }}
                        rateHintClassName="mt-1 text-[9px] text-[var(--color-text-muted)]"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Currency</label>
                          <input
                            type="text"
                            value={editForm.metadata?.currency}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, currency: e.target.value }
                            }))}
                            onBlur={() => updateMutation.mutate({
                              id: selectedDoc._id,
                              payload: { metadata: { ...selectedDoc.metadata, currency: editForm.metadata.currency } }
                            })}
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                            Tax Amount
                            <InfoTooltip content="Extracted CGST, SGST, IGST, VAT, or simple tax values from the receipt." />
                          </label>
                          <input
                            type="number"
                            value={editForm.metadata?.tax || ''}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, tax: e.target.value }
                            }))}
                            onBlur={() => updateMutation.mutate({
                              id: selectedDoc._id,
                              payload: { metadata: { ...selectedDoc.metadata, tax: parseFloat(editForm.metadata.tax) || 0 } }
                            })}
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Doc Date</label>
                          <input
                            type="date"
                            value={editForm.metadata?.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditForm(prev => ({
                                ...prev,
                                metadata: { ...prev.metadata, date: val }
                              }));
                              updateMutation.mutate({
                                id: selectedDoc._id,
                                payload: { metadata: { ...selectedDoc.metadata, date: val ? new Date(val) : null } }
                              });
                            }}
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* System Metadata Details */}
                    <div className="border-t border-[var(--color-bg-border)] pt-4 space-y-2 text-[10px] text-[var(--color-text-muted)]">
                      <div className="flex justify-between">
                        <span>Uploaded By</span>
                        <span className="font-bold text-[var(--color-text-primary)]">{selectedDoc.uploadedBy?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Uploaded On</span>
                        <span className="font-bold text-[var(--color-text-primary)]">
                          {new Date(selectedDoc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>File Type</span>
                        <span className="font-bold text-[var(--color-text-primary)]">{selectedDoc.fileType || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>File Size</span>
                        <span className="font-bold text-[var(--color-text-primary)]">{formatBytes(selectedDoc.fileSize)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Save / Done */}
                <div className="p-4 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] flex justify-end">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="px-5 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
};

export default FinancePage;


// Performance Optimization: useCallback(eventHandler) memoization guard
