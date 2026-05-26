import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Trash2, Download, Filter, Search,
  FolderOpen, X, ChevronDown, BarChart3, HardDrive, File,
  FileSpreadsheet, Image as ImageIcon, AlertCircle, Loader2,
  Calendar, ChevronLeft, ChevronRight, Info, Edit, Check, Eye, ArrowLeft
} from 'lucide-react';
import { uploadFiles } from '../../utils/uploadthing';

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

const getFileIcon = (type) => {
  if (!type) return File;
  if (type.includes('pdf')) return FileText;
  if (type.includes('sheet') || type.includes('csv') || type.includes('excel')) return FileSpreadsheet;
  if (type.includes('image')) return ImageIcon;
  return File;
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
      <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  </div>
);

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
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  
  // Search & Filters
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Staged Uploads
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Selected document for Workspace Preview Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editForm, setEditForm] = useState(null);

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
    } else {
      setEditForm(null);
    }
  }, [selectedDoc?._id]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, selectedCategory, searchQuery, startDate, endDate]);

  // Escape key handler to close the FullScreenWorkspace preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedDoc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await axios.get('/api/projects')).data,
  });

  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['finance-docs', selectedProject, selectedCategory, startDate, endDate, searchQuery, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProject) params.set('project', selectedProject);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (searchQuery) params.set('searchQuery', searchQuery);
      params.set('page', currentPage);
      params.set('limit', 10);
      return (await axios.get(`/api/finance?${params}`)).data;
    },
  });

  const { data: statsRes } = useQuery({
    queryKey: ['finance-stats'],
    queryFn: async () => (await axios.get('/api/finance/stats')).data,
  });

  const docs = docsRes?.data || [];
  const pagination = docsRes?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };
  const stats = statsRes?.data || {};

  const bulkCreateMutation = useMutation({
    mutationFn: (payload) => axios.post('/api/finance/bulk', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
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
      queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
      setSelectedDoc(res.data.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/finance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-docs'] });
      queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
      setSelectedDoc(null);
    },
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await uploadFiles('financeDocUploader', {
        files,
        headers: {
          authorization: `Bearer ${localStorage.getItem('coreknot_token')}`
        },
        onUploadProgress: ({ file, progress }) => {
          setUploadProgress(progress);
        }
      });
      
      if (res && res.length > 0) {
        const newStaged = res.map((uploaded, index) => ({
          id: Date.now() + '-' + index,
          title: uploaded.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ').trim(),
          description: '',
          project: selectedProject || (projects[0]?._id || ''),
          category: 'other',
          fileUrl: uploaded.url,
          fileKey: uploaded.key,
          fileName: uploaded.name,
          fileSize: uploaded.size,
          fileType: files[index]?.type || uploaded.name?.split('.').pop()
        }));
        setStagedFiles(prev => [...prev, ...newStaged]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateStagedFile = (id, field, value) => {
    setStagedFiles(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeStagedFile = (id) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleBulkSubmit = () => {
    if (stagedFiles.length === 0) return;
    bulkCreateMutation.mutate({ documents: stagedFiles });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Finance Documents</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Manage project invoices, contracts, and financial records</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-action-primary)] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow"
        >
          <Upload size={16} />
          Upload Documents
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Total Documents" value={stats.totalDocuments || 0} color="#3B82F6" />
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(stats.totalSize)} color="#8B5CF6" />
        <StatCard icon={FolderOpen} label="Projects" value={stats.byProject?.length || 0} color="#10B981" />
        <StatCard icon={BarChart3} label="Categories" value={stats.byCategory?.length || 0} color="#F59E0B" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search title, file name, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* Project Select */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
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
            <button onClick={() => { setStartDate(''); setEndDate(''); }} className="p-0.5 hover:bg-[var(--color-bg-border)] rounded">
              <X size={12} className="text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">Loading documents...</div>
        ) : docs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto text-[var(--color-text-muted)] opacity-30 mb-3" />
            <p className="text-sm font-bold text-[var(--color-text-muted)]">No documents found</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Upload your first finance document to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]">
                  {['Document', 'Project', 'Category', 'Size', 'Uploaded By', 'Date', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const FileIcon = getFileIcon(doc.fileType);
                  const cat = CAT_COLORS[doc.category] || CAT_COLORS.other;
                  const isImage = doc.fileType?.includes('image') || /\.(png|jpe?g|webp)$/i.test(doc.fileName);

                  return (
                    <motion.tr
                      key={doc._id}
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
                        {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete document?')) deleteMutation.mutate(doc._id); }}
                            className="p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 bg-[var(--color-bg-surface)] border-t border-[var(--color-bg-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">
              Showing page <b>{pagination.page}</b> of <b>{pagination.pages}</b> ({pagination.total} documents)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 border border-[var(--color-bg-border)] rounded-lg text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-bg-border)] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={currentPage === pagination.pages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                className="p-1.5 border border-[var(--color-bg-border)] rounded-lg text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-bg-border)] transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal (Multiple staged files) */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { if (!isUploading) setShowUpload(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Upload Finance Documents</h2>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Stage multiple files, customize metadata, and parse with OCR.</p>
                </div>
                <button
                  disabled={isUploading}
                  onClick={() => setShowUpload(false)}
                  className="p-1 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors disabled:opacity-30"
                >
                  <X size={18} className="text-[var(--color-text-muted)]" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {stagedFiles.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">{stagedFiles.length} files staged</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1.5"
                      >
                        <Upload size={14} /> Add More Documents
                      </button>
                    </div>

                    <div className="space-y-3">
                      {stagedFiles.map((file) => (
                        <div key={file.id} className="p-3 border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] rounded-xl relative space-y-3">
                          <button
                            onClick={() => removeStagedFile(file.id)}
                            className="absolute top-2 right-2 p-1 hover:bg-red-500/10 rounded text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>

                          <div className="flex items-center gap-3">
                            <FileText size={18} className="text-blue-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[var(--color-text-primary)] truncate pr-6">{file.fileName}</p>
                              <p className="text-[10px] text-[var(--color-text-muted)]">{formatBytes(file.fileSize)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            <div>
                              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Title</label>
                              <input
                                type="text"
                                value={file.title}
                                onChange={(e) => updateStagedFile(file.id, 'title', e.target.value)}
                                className="w-full px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Project</label>
                              <select
                                value={file.project}
                                onChange={(e) => updateStagedFile(file.id, 'project', e.target.value)}
                                className="w-full px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
                              >
                                <option value="">Select Project</option>
                                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">Category</label>
                              <select
                                value={file.category}
                                onChange={(e) => updateStagedFile(file.id, 'category', e.target.value)}
                                className="w-full px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
                              >
                                {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[var(--color-bg-border)] rounded-xl hover:border-blue-500/50 cursor-pointer transition-colors group bg-[var(--color-bg-workspace)]"
                  >
                    <Upload size={32} className="text-[var(--color-text-muted)] group-hover:text-blue-500 mb-2 transition-colors" />
                    <p className="text-xs font-bold text-blue-500">Choose files or drag and drop</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Select one or multiple PDFs/Images up to 32MB</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.xls,.xlsx,.csv"
                  className="hidden"
                />

                {/* Inline Progress Bar */}
                {isUploading && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-blue-500">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> Uploading to secure storage...
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-border)] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[var(--color-bg-border)] flex justify-end gap-2 bg-[var(--color-bg-surface)]">
                <button
                  disabled={isUploading}
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-border)] rounded-xl transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSubmit}
                  disabled={stagedFiles.length === 0 || stagedFiles.some(f => !f.title || !f.project) || isUploading || bulkCreateMutation.isPending}
                  className="px-4 py-2 bg-[var(--color-action-primary)] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-blue-500/30 transition-all"
                >
                  {bulkCreateMutation.isPending ? 'Uploading & Parsing...' : `Save ${stagedFiles.length} Document${stagedFiles.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      onClick={() => { if (confirm('Are you sure you want to delete this document?')) deleteMutation.mutate(selectedDoc._id); }}
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
                          className="w-full px-2 py-2 bg-[var(--color-bg-workspace)] border border(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
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
                        <div>
                          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                            Total Amount
                            <InfoTooltip content="Grand Total/Amount parsed. Represented in detected currency." />
                          </label>
                          <input
                            type="number"
                            value={editForm.metadata?.amount || ''}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, amount: e.target.value }
                            }))}
                            onBlur={() => updateMutation.mutate({
                              id: selectedDoc._id,
                              payload: { metadata: { ...selectedDoc.metadata, amount: parseFloat(editForm.metadata.amount) || 0 } }
                            })}
                            className="w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
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
    </div>
  );
};

export default FinancePage;
