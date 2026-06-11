import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { loadPageFilters, savePageFilters } from '../../utils/pageFilterStorage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Trash2, Download,
  FolderOpen, X, ChevronDown, File,
  FileSpreadsheet, Image as ImageIcon,
  Calendar, ChevronLeft, ChevronRight, Info, Check, Eye, ArrowLeft,
  FolderPlus, Clock, XCircle,
} from 'lucide-react';
import { uploadFinanceFiles } from '../../utils/financeUpload';
import UploadDocumentModal from '../../components/finance/UploadDocumentModal';
import NeedsAttentionAccordion from '../../components/finance/NeedsAttentionAccordion';
import UsdInrAmountFields from '../../components/finance/UsdInrAmountFields';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { inrToUsd } from '../../utils/usdInr';
import { Button, SearchInput, NexusDropdown, EmptyState, IconButton, TablePagination, ListPageLayout, DesktopRecommendedBanner, DataLoading, DataTable, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { buildFinanceTableColumns } from '../../components/finance/buildFinanceTableColumns';
import { FINANCE_CATEGORIES, buildFinanceTableRows, formatFinanceBytes } from '../../utils/financeDisplay';
import { NexusModal } from '../../components/ui/modals';;
import { useConfirm } from '../../contexts/confirmContext';
import { formatProjectName, normalizeProjects, normalizePopulatedProjectList } from '../../utils/projectUtils';
import WorkspaceProjectFields, { filterProjectsByWorkspace } from '../../components/forms/WorkspaceProjectFields';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { useUnsavedChanges, stableJsonEqual } from '../../hooks/useUnsavedChanges';
import {
  buildFinanceEditForm,
  cloneFinanceEditForm,
  financeEditPayload,
} from '../../utils/financeEditForm';

const CATEGORIES = FINANCE_CATEGORIES;

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
  const [newFolderWorkspace, setNewFolderWorkspace] = useState('General');
  const [newFolderProject, setNewFolderProject] = useState('');

  const FINANCE_FILTERS_KEY = 'finance-filters';
  const savedFinanceFilters = useMemo(() => loadPageFilters(FINANCE_FILTERS_KEY, {
    selectedWorkspace: '',
    selectedProject: '',
    selectedCategory: 'all',
    pageSize: 10,
    sortField: 'docDate',
    sortOrder: 'desc',
  }), []);

  const [selectedWorkspace, setSelectedWorkspace] = useState(savedFinanceFilters.selectedWorkspace);
  const [selectedProject, setSelectedProject] = useState(savedFinanceFilters.selectedProject);
  const [selectedCategory, setSelectedCategory] = useState(savedFinanceFilters.selectedCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedFinanceFilters.pageSize);
  const [sortConfig, setSortConfig] = useState({
    field: savedFinanceFilters.sortField,
    order: savedFinanceFilters.sortOrder,
  });

  useEffect(() => {
    savePageFilters(FINANCE_FILTERS_KEY, {
      selectedWorkspace,
      selectedProject,
      selectedCategory,
      pageSize,
      sortField: sortConfig.field,
      sortOrder: sortConfig.order,
    });
  }, [selectedWorkspace, selectedProject, selectedCategory, pageSize, sortConfig]);

  const [stagedFiles, setStagedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Selected document for Workspace Preview Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editBaseline, setEditBaseline] = useState(null);
  const [editAmountUsd, setEditAmountUsd] = useState('');
  const [flashOcrFields, setFlashOcrFields] = useState(() => new Set());

  const { data: rateData } = useUsdInrRate({ enabled: !!selectedDoc });
  const usdInrRate = rateData?.rate;

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => normalizeProjects((await axios.get('/api/projects')).data),
  });

  useEffect(() => {
    if (!selectedDoc?._id) {
      setFlashOcrFields(new Set());
      return;
    }
    const fields = new Set();
    if (selectedDoc.metadata?.vendor) fields.add('vendor');
    if (selectedDoc.metadata?.amount) fields.add('amount');
    if (selectedDoc.metadata?.tax) fields.add('tax');
    if (selectedDoc.metadata?.date) fields.add('date');
    if (fields.size > 0) {
      setFlashOcrFields(fields);
      const t = setTimeout(() => setFlashOcrFields(new Set()), 2200);
      return () => clearTimeout(t);
    }
    setFlashOcrFields(new Set());
  }, [selectedDoc?._id]);

  useEffect(() => {
    if (selectedDoc) {
      const form = buildFinanceEditForm(selectedDoc, projects);
      setEditForm(form);
      setEditBaseline(cloneFinanceEditForm(form));
      setEditAmountUsd('');
    } else {
      setEditForm(null);
      setEditBaseline(null);
      setEditAmountUsd('');
    }
  }, [selectedDoc?._id, projects]);

  useEffect(() => {
    if (!selectedDoc || !editForm?.metadata?.amount) return;
    if (!Number.isFinite(usdInrRate) || usdInrRate <= 0) return;
    setEditAmountUsd((prev) => (prev === '' ? String(inrToUsd(editForm.metadata.amount, usdInrRate)) : prev));
  }, [selectedDoc?._id, usdInrRate, editForm?.metadata?.amount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, selectedCategory, searchQuery, startDate, endDate, currentFolderId, pageSize, sortConfig.field, sortConfig.order]);

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

  const { data: workspaces = [] } = useWorkspaces();

  const filteredProjects = useMemo(
    () => filterProjectsByWorkspace(projects, selectedWorkspace || 'all'),
    [projects, selectedWorkspace]
  );

  const { data: docsRes, isLoading, isError: docsError, error: docsErr } = useQuery({
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
    const projectRecord = projects.find((p) => p._id === projectId);
    setNewFolderWorkspace(projectRecord?.workspace || selectedWorkspace || 'General');
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
      setNewFolderWorkspace('General');
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

  const hasFinanceEdits =
    !!selectedDoc && !!editForm && !!editBaseline && !stableJsonEqual(editForm, editBaseline);

  const handleSaveFinanceEdits = async () => {
    if (!selectedDoc || !editForm) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedDoc._id,
        payload: financeEditPayload(editForm, selectedDoc),
      });
      setEditBaseline(cloneFinanceEditForm(editForm));
    } catch {
      /* updateMutation onError handles alert */
    }
  };

  const handleRevertFinanceEdits = () => {
    if (editBaseline) setEditForm(cloneFinanceEditForm(editBaseline));
  };

  useUnsavedChanges({
    baseline: editBaseline,
    draft: editForm,
    setDraft: setEditForm,
    hasChanges: hasFinanceEdits,
    onSave: handleSaveFinanceEdits,
    onCancel: handleRevertFinanceEdits,
    isSaving: updateMutation.isPending,
    enabled: !!selectedDoc && !!editForm,
    elevated: true,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId) => axios.delete(`/api/finance/folders/${folderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      queryClient.invalidateQueries({ queryKey: ['finance-folders'] });
    },
  });

  const { data: pendingRes } = useQuery({
    queryKey: ['finance-pending-invoices'],
    queryFn: async () => (await axios.get('/api/finance/pending')).data,
  });
  const pendingInvoices = pendingRes?.data || [];

  const approveInvoiceMutation = useMutation({
    mutationFn: (id) => axios.patch(`/api/finance/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-pending-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || 'Failed to approve invoice');
    },
  });

  const rejectInvoiceMutation = useMutation({
    mutationFn: ({ id, reason }) => axios.patch(`/api/finance/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-pending-invoices'] });
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || 'Failed to reject invoice');
    },
  });

  const handleRejectInvoice = async (invoice) => {
    const reason = window.prompt(`Reject "${invoice.title}"? Optional reason:`);
    if (reason === null) return;
    rejectInvoiceMutation.mutate({ id: invoice._id, reason: reason.trim() });
  };

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

  const handleConfirmDeleteDoc = useCallback(async (doc) => confirm({
    title: 'Delete document?',
    message: `Delete "${doc.title || doc.fileName || 'this document'}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    type: 'danger',
  }), [confirm]);

  const financeTableRows = useMemo(
    () => buildFinanceTableRows(docs, { currentFolderId, selectedProject }),
    [docs, currentFolderId, selectedProject],
  );

  const financeColumns = useMemo(
    () => buildFinanceTableColumns({
      onViewDoc: setSelectedDoc,
      onDeleteDoc: (id) => deleteMutation.mutate(id),
      onDeleteFolder: handleDeleteFolder,
      onConfirmDeleteDoc: handleConfirmDeleteDoc,
      deleteFolderPending: deleteFolderMutation.isPending,
    }),
    [handleConfirmDeleteDoc, handleDeleteFolder, deleteMutation, deleteFolderMutation.isPending],
  );

  const handleFinanceRowClick = useCallback((row) => {
    if (row._isDivider) return;
    if (row.isFolder) {
      if (!selectedProject && row.project?._id) setSelectedProject(row.project._id);
      navigateToFolder(row._id);
      return;
    }
    setSelectedDoc(row);
  }, [selectedProject, navigateToFolder]);

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

  const financeOverview = useMemo(() => {
    const mix = docsRes?.categoryMix || [];
    const mixByKey = Object.fromEntries(mix.map(({ key, count }) => [key, count || 0]));
    const fileCount = mix.reduce((sum, row) => sum + (row.count || 0), 0);

    const fourthStat = pendingInvoices.length > 0
      ? {
          id: 'pending',
          label: 'Pending approval',
          value: pendingInvoices.length,
          icon: Clock,
          variant: 'warning',
          info: 'Invoices awaiting ops approval.',
        }
      : {
          id: 'reimbursements',
          label: 'Reimbursements',
          value: mixByKey.reimbursements || 0,
          icon: FileSpreadsheet,
          variant: 'rose',
          info: 'Reimbursement submissions in the current scope.',
        };

    const stats = [
      {
        id: 'total',
        label: 'Documents',
        value: pagination.total,
        icon: FileText,
        variant: 'info',
        info: 'Files and folders matching current filters.',
      },
      {
        id: 'files',
        label: 'Files',
        value: fileCount,
        icon: File,
        variant: 'mint',
        info: 'Non-folder documents in the current scope.',
      },
      {
        id: 'invoices',
        label: 'Invoices',
        value: mixByKey.invoice || 0,
        icon: FileText,
        variant: 'apricot',
        info: 'Invoice-type documents in the current scope.',
      },
      fourthStat,
    ];

    return { stats };
  }, [docsRes?.categoryMix, pagination.total, pendingInvoices.length]);

  return (
    <ListPageLayout
      maxWidth="1400px"
      containerClassName="!py-4"
      className="!space-y-2"
      overviewSectionClassName="!mb-0 !space-y-0"
      toolbarFill
      overview={financeOverview}
      toolbarActions={(
        <>
          <Button variant="secondary" size="sm" onClick={openNewFolderModal}>
            <FolderPlus size={16} /> New Folder
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Upload Documents
          </Button>
        </>
      )}
      toolbar={(
        <>
          <SearchInput
            
            placeholder="Search title, file name, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <NexusDropdown
            variant="toolbar"
            
            placeholder="All workspaces"
            value={selectedWorkspace}
            onChange={(value) => {
              setSelectedWorkspace(value);
              setSelectedProject('');
              goToProjectRoot();
            }}
            options={[
              { value: '', label: 'All workspaces' },
              ...workspaces.map((w) => ({ value: w.name, label: w.name })),
            ]}
          />
          <NexusDropdown
            variant="toolbar"
           
            placeholder="All projects"
            value={selectedProject}
            onChange={(projectId) => {
              setSelectedProject(projectId);
              const projectRecord = projects.find((p) => p._id === projectId);
              if (projectRecord?.workspace) setSelectedWorkspace(projectRecord.workspace);
              goToProjectRoot();
            }}
            options={[
              { value: '', label: 'All projects' },
              ...filteredProjects.map((p) => ({ value: p._id, label: p.name })),
            ]}
            searchable
          />
          <NexusDropdown
            variant="toolbar"
            
            placeholder="All types"
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <div className="tm-toolbar-field tm-toolbar-date-range tm-toolbar-control shrink-0">
            <Calendar size={14} className="text-[var(--color-text-muted)] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Document date from"
            />
            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Document date to"
            />
            {(startDate || endDate) && (
              <IconButton icon={X} label="Clear dates" size="sm" className="!p-1 shrink-0" onClick={() => { setStartDate(''); setEndDate(''); }} />
            )}
          </div>
        </>
      )}
    >
      {docsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(docsErr, 'Failed to load finance documents')}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['finance-docs'] })}
        />
      )}
      <NeedsAttentionAccordion
        pendingInvoices={pendingInvoices}
        onApprove={(id) => approveInvoiceMutation.mutate(id)}
        onReject={handleRejectInvoice}
        isApproving={approveInvoiceMutation.isPending}
        isRejecting={rejectInvoiceMutation.isPending}
      />
      <DesktopRecommendedBanner message="Finance document management works best on desktop. You can browse folders on mobile with limited preview." />

      {/* Documents Table */}
      <div className="min-w-0 overflow-hidden">
        {tableBreadcrumb}
        {folderToolbar}
        {isLoading ? (
          <div className="p-8 flex justify-center"><DataLoading showPhrase /></div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={currentFolderId ? `No documents in ${activeFolder?.folderName || 'this folder'}` : 'No documents found'}
            description={currentFolderId ? 'Upload documents into this folder' : 'Select a project or upload documents'}
            actionLabel={currentFolderId ? `Back to ${selectedProjectName || 'project'}` : undefined}
            onAction={currentFolderId ? goToProjectRoot : undefined}
          />
        ) : (
          <DataTable
            columns={financeColumns}
            data={financeTableRows}
            serverSide
            paginated={false}
            virtualize={false}
            tableMaxHeight="70vh"
            sortState={sortConfig.field ? { key: sortConfig.field, direction: sortConfig.order } : null}
            onSortChange={(state) => {
              if (!state?.key || !state?.direction) {
                setSortConfig({ field: null, order: 'asc' });
              } else {
                setSortConfig({ field: state.key, order: state.direction });
              }
            }}
            onRowClick={handleFinanceRowClick}
            getRowId={(row) => row._id}
            getRowClassName={(row) => {
              if (row._isDivider) return 'bg-[var(--color-bg-workspace)] pointer-events-none';
              if (row.isFolder) return 'hover:bg-amber-500/5';
              return '';
            }}
          />
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
        isParsing={bulkCreateMutation.isPending}
      />

      <NexusModal
        isOpen={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        title="Create folder"
        size="md"
        showFooter={false}
      >
        <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
          Folders live at project root{newFolderProjectName ? ` — ${newFolderProjectName}` : ''}.
        </p>
        <WorkspaceProjectFields
          projects={projects}
          workspace={newFolderWorkspace}
          projectId={newFolderProject}
          onChange={({ workspace, projectId }) => {
            setNewFolderWorkspace(workspace);
            setNewFolderProject(projectId);
          }}
          layout="stacked"
        />
        <div className="mt-4">
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
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewFolder(false)}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            disabled={!newFolderName.trim() || !newFolderProject || createFolderMutation.isPending}
            onClick={() => createFolderMutation.mutate({ folderName: newFolderName.trim(), project: newFolderProject })}
          >
            {createFolderMutation.isPending ? 'Creating…' : 'Create folder'}
          </Button>
        </div>
      </NexusModal>

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
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-action-primary)] text-white rounded-[var(--radius-atomic)] text-xs font-bold hover:opacity-90 transition-colors"
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
                          message: `Delete "${selectedDoc.title || selectedDoc.fileName || 'this document'}"? This cannot be undone.`,
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
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50"
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
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-action-primary)]/50 resize-none"
                      />
                    </div>

                    <WorkspaceProjectFields
                      projects={projects}
                      workspace={editForm.workspace || 'General'}
                      projectId={editForm.project || ''}
                      onChange={({ workspace, projectId }) => {
                        setEditForm((prev) => ({ ...prev, workspace, project: projectId }));
                        updateMutation.mutate({ id: selectedDoc._id, payload: { project: projectId || null } });
                      }}
                      layout="inline"
                      allowEmptyProject
                      emptyProjectLabel="No Project"
                    />
                    <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Category</label>
                        <select
                          value={editForm.category}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditForm(prev => ({ ...prev, category: val }));
                            updateMutation.mutate({ id: selectedDoc._id, payload: { category: val } });
                          }}
                          className="w-full px-2 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50 cursor-pointer"
                        >
                          {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>

                    {selectedDoc.metadata?.submissionType && (
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                          Submission Type
                        </label>
                        <div className="px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs font-bold text-[var(--color-text-primary)] capitalize">
                          {selectedDoc.metadata.submissionType === 'reimbursement' ? 'Reimbursement' : 'Invoice'}
                        </div>
                      </div>
                    )}

                    {/* OCR Extractions (Display fields & updates) */}
                    <div className="p-3 bg-slate-100/60 dark:bg-slate-800/25 border border-[var(--color-bg-border)] rounded-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">OCR/OMR Extracted Metadata</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-0.5">
                          <Check size={10} /> Auto Extracted
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className={flashOcrFields.has('vendor') ? 'flash-highlight rounded-lg' : ''}>
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
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50"
                          />
                        </div>
                      </div>

                      <div className={flashOcrFields.has('amount') ? 'flash-highlight rounded-lg' : ''}>
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
                      </div>

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
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50"
                          />
                        </div>
                        <div className={flashOcrFields.has('tax') ? 'flash-highlight rounded-lg' : ''}>
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
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50"
                          />
                        </div>
                        <div className={flashOcrFields.has('date') ? 'flash-highlight rounded-lg' : ''}>
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
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {selectedDoc.metadata?.attachments?.length > 0 && (
                      <div className="border-t border-[var(--color-bg-border)] pt-4 space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] block">
                          Attached Documents ({selectedDoc.metadata.attachments.length})
                        </label>
                        <ul className="space-y-1.5">
                          {selectedDoc.metadata.attachments.map((file, index) => (
                            <li key={file.fileKey || file.fileUrl || index}>
                              <a
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:underline truncate"
                              >
                                <FileText size={12} className="shrink-0" />
                                <span className="truncate">{file.fileName || `Document ${index + 1}`}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
                        <span className="font-bold text-[var(--color-text-primary)]">{formatFinanceBytes(selectedDoc.fileSize)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Save / Done */}
                <div className="p-4 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] flex justify-end">
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="px-5 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-[var(--radius-atomic)] hover:opacity-90 transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ListPageLayout>
  );
};

export default FinancePage;


// Performance Optimization: useCallback(eventHandler) memoization guard
