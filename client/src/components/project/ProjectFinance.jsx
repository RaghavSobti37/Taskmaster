import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Search, Download, Trash2, ChevronDown, 
  ChevronLeft, ChevronRight, X, Eye, Check, Info, ArrowLeft
} from 'lucide-react';
import UsdInrAmountFields from '../finance/UsdInrAmountFields';
import { buildProjectFinanceTableColumns } from '../finance/buildFinanceTableColumns';
import { DataTable } from '../ui';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { inrToUsd } from '../../utils/usdInr';
import { useConfirm } from '../../contexts/confirmContext';
import { ESCAPE_OVERLAY_PROPS } from '../../lib/escapeBack';

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
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-900 text-slate-100 text-[10px] rounded-lg shadow-xl pointer-events-none text-center"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectFinanceTable = ({ docs, isLoading, onViewDoc, onDeleteDoc, confirm }) => {
  const handleConfirmDeleteDoc = useCallback(async () => confirm({
    title: 'Delete record?',
    message: 'Delete record?',
    confirmLabel: 'Delete',
    type: 'danger',
  }), [confirm]);

  const columns = useMemo(
    () => buildProjectFinanceTableColumns({
      onViewDoc,
      onDeleteDoc,
      onConfirmDeleteDoc: handleConfirmDeleteDoc,
    }),
    [onViewDoc, onDeleteDoc, handleConfirmDeleteDoc],
  );

  return (
    <DataTable
      columns={columns}
      data={docs}
      isLoading={isLoading}
      serverSide
      paginated={false}
      virtualize={false}
      onRowClick={onViewDoc}
      getRowId={(row) => row._id}
      emptyTitle="No finance records for this project"
      emptyDescription="Upload invoices and receipts for this project to see them here."
    />
  );
};

const ProjectFinance = ({ projectId }) => {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
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

  // Reset page when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Close preview on Escape without triggering global Escape→back
  useEffect(() => {
    if (!selectedDoc) return;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setSelectedDoc(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDoc]);

  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['project-finance-docs', projectId, selectedCategory, searchQuery, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('project', projectId);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('searchQuery', searchQuery);
      params.set('page', currentPage);
      params.set('limit', 10);
      return (await axios.get(`/api/finance?${params}`)).data;
    }
  });

  const docs = docsRes?.data || [];
  const pagination = docsRes?.pagination || { total: 0, page: 1, limit: 10, pages: 1 };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => axios.patch(`/api/finance/${id}`, payload, {
      headers: { 'x-skip-toast': 'true' }
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['project-finance-docs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
      setSelectedDoc(res.data.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/finance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-finance-docs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
      setSelectedDoc(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-6">
        <div className="relative flex-1 max-w-sm w-full">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder="Search bills, invoices, vendor name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none text-[var(--color-text-primary)]"
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:outline-none cursor-pointer w-full"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Finance Table */}
      <div className="overflow-hidden border-t border-[var(--color-bg-border)]">
        <ProjectFinanceTable
          docs={docs}
          isLoading={isLoading}
          onViewDoc={setSelectedDoc}
          onDeleteDoc={(id) => deleteMutation.mutate(id)}
          confirm={confirm}
        />

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="px-6 py-3 bg-[var(--color-bg-workspace)]/30 border-t border-[var(--color-bg-border)] flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 border border-[var(--color-bg-border)] rounded-lg text-[var(--color-text-primary)] disabled:opacity-40 hover:bg-[var(--color-bg-border)] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={currentPage === pagination.pages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                className="p-1.5 border border-[var(--color-bg-border)] rounded-lg text-[var(--color-text-primary)] disabled:opacity-40 hover:bg-[var(--color-bg-border)] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Immersive Preview Modal (70% Left, 30% Right) */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            {...ESCAPE_OVERLAY_PROPS}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-full bg-[var(--color-bg-surface)] border-l border-[var(--color-bg-border)] flex flex-col md:flex-row overflow-hidden"
            >
              {/* Document Viewer (70% Left) */}
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

                <div className="w-full h-full flex items-center justify-center p-6">
                  {selectedDoc.fileType?.includes('pdf') ? (
                    <iframe
                      src={selectedDoc.fileUrl}
                      title={selectedDoc.title}
                      className="w-full h-full rounded-xl border border-slate-800 bg-slate-900"
                    />
                  ) : selectedDoc.fileType?.includes('image') || /\.(png|jpe?g|webp)$/i.test(selectedDoc.fileName) ? (
                    <img
                      src={selectedDoc.fileUrl}
                      alt={selectedDoc.title}
                      className="max-w-full max-h-full object-contain rounded-xl border border-slate-800"
                    />
                  ) : (
                    <div className="text-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl max-w-sm">
                      <FileText size={48} className="mx-auto text-slate-500 mb-3" />
                      <p className="text-sm font-bold text-slate-300">Preview not supported</p>
                      <p className="text-xs text-slate-500 mt-1">Download file to view.</p>
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

              {/* Details & Metadata Panel (30% Right) */}
              <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-[var(--color-bg-border)] h-[50vh] md:h-full flex flex-col bg-[var(--color-bg-surface)]">
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
                          message: 'Delete document?',
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

                {editForm && (
                  <div className="p-4 overflow-y-auto flex-1 space-y-4 text-left">
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

                    {/* OCR Extractions */}
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
                          {formatDisplayDateTime(new Date(selectedDoc.createdAt))}
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

export default ProjectFinance;
