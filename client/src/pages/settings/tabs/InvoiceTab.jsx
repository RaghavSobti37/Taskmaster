import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Receipt, FileText, Upload, Clock, CheckCircle, XCircle, Info, X } from 'lucide-react';
import { Input, Button, DataTable } from '../../../components/ui';
import QueryErrorSlot from '../../../components/ui/QueryErrorSlot';
import { NexusModal } from '../../../components/ui/modals';;
import WorkspaceProjectFields from '../../../components/forms/WorkspaceProjectFields';
import { useProjects } from '../../../hooks/queries/projects';
import { useWorkspaces, useMyReimbursements } from '../../../hooks/useTaskmasterQueries';
import { uploadFiles } from '../../../utils/uploadthing';
import { formatProjectName } from '../../../utils/projectUtils';
import { normalizeWorkspaceKey } from '../../../utils/workspaceColors';

const STATUS_STYLES = {
  pending: { label: 'Pending approval', className: 'text-amber-600 bg-amber-500/10' },
  approved: { label: 'Approved', className: 'text-emerald-600 bg-emerald-500/10' },
  rejected: { label: 'Rejected', className: 'text-rose-600 bg-rose-500/10' },
};

const DEFAULT_WORKSPACE_TARGET = 'TSC CORPORATE';

const compactInputClass =
  'w-full px-2.5 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-action-primary)]/50';

const INITIAL_FORM = {
  title: '',
  description: '',
  workspace: DEFAULT_WORKSPACE_TARGET,
  projectId: '',
  vendor: '',
  amountInr: '',
  tax: '',
  docDate: '',
};

const mapUploadedFile = (uploaded, file) => ({
  fileUrl: uploaded.url || uploaded.ufsUrl,
  fileKey: uploaded.key,
  fileName: uploaded.name || file.name,
  fileSize: uploaded.size || file.size,
  fileType: file.type,
});

export default function InvoiceTab() {
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: workspaces = [] } = useWorkspaces();
  const [form, setForm] = useState(INITIAL_FORM);
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const receiptFileRef = useRef(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!workspaces.length) return;
    const match = workspaces.find((w) => {
      const key = normalizeWorkspaceKey(w.name);
      return key === normalizeWorkspaceKey(DEFAULT_WORKSPACE_TARGET) || key.includes('CORPORATE');
    });
    if (match) {
      setForm((prev) => ({ ...prev, workspace: match.name }));
    }
  }, [workspaces]);

  const {
    data: myReimbursements = [],
    isLoading: reimbursementsLoading,
    isError: reimbursementsError,
    error: reimbursementsErr,
    refetch: refetchReimbursements,
  } = useMyReimbursements();

  const reimbursementColumns = useMemo(
    () => [
      { header: 'Title', render: (item) => <span className="tm-data-primary font-semibold">{item.title}</span> },
      {
        header: 'Project',
        render: (item) => (item.project?.name ? formatProjectName(item.project.name) : '—'),
      },
      { header: 'Merchant', render: (item) => item.metadata?.vendor || '—' },
      {
        header: 'Amount',
        render: (item) =>
          item.metadata?.amount ? (
            <span className="tabular-nums">₹{Number(item.metadata.amount).toLocaleString('en-IN')}</span>
          ) : '—',
      },
      {
        header: 'Files',
        render: (item) => item.metadata?.attachments?.length || (item.fileUrl ? 1 : 0),
      },
      {
        header: 'Status',
        render: (item) => {
          const status = STATUS_STYLES[item.approvalStatus] || STATUS_STYLES.pending;
          return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.className}`}>
              {item.approvalStatus === 'approved' && <CheckCircle size={12} />}
              {item.approvalStatus === 'rejected' && <XCircle size={12} />}
              {item.approvalStatus === 'pending' && <Clock size={12} />}
              {status.label}
            </span>
          );
        },
      },
      {
        header: 'Submitted',
        render: (item) =>
          item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—',
      },
    ],
    []
  );

  const patchForm = (updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
    const cleared = Object.keys(updates).reduce((acc, key) => {
      if (fieldErrors[key]) acc[key] = '';
      return acc;
    }, {});
    if (Object.keys(cleared).length) {
      setFieldErrors((prev) => ({ ...prev, ...cleared }));
    }
  };

  const handleReceiptSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      setReceiptFiles(files);
      setFieldErrors((prev) => ({ ...prev, file: '' }));
    }
  };

  const removeReceiptFile = (index) => {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
    if (receiptFileRef.current) receiptFileRef.current.value = '';
  };

  const resetForm = () => {
    setForm({ ...INITIAL_FORM, workspace: form.workspace || DEFAULT_WORKSPACE_TARGET });
    setReceiptFiles([]);
    if (receiptFileRef.current) receiptFileRef.current.value = '';
  };

  const handleSubmit = async () => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (receiptFiles.length === 0) errors.file = 'At least one receipt or proof document is required';
    if (!form.amountInr || Number(form.amountInr) <= 0) errors.amountInr = 'Total amount (INR) is required';
    if (!form.docDate) errors.docDate = 'Expense date is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const uploadRes = await uploadFiles('financeDocUploader', {
        files: receiptFiles,
      });

      const attachments = uploadRes
        .map((uploaded, index) => mapUploadedFile(uploaded, receiptFiles[index]))
        .filter((item) => item.fileUrl);

      if (attachments.length === 0) throw new Error('File upload failed');

      const primary = attachments[0];

      await axios.post('/api/finance/submit-invoice', {
        title: form.title.trim(),
        description: form.description.trim(),
        project: form.projectId || null,
        fileUrl: primary.fileUrl,
        fileKey: primary.fileKey,
        fileName: primary.fileName,
        fileSize: primary.fileSize,
        fileType: primary.fileType,
        attachments,
        metadata: {
          vendor: form.vendor.trim(),
          amount: parseFloat(form.amountInr) || 0,
          currency: 'INR',
          tax: parseFloat(form.tax) || 0,
          date: form.docDate,
          submissionType: 'reimbursement',
        },
      });

      resetForm();
      queryClient.invalidateQueries({ queryKey: ['my-reimbursements'] });
      queryClient.invalidateQueries({ queryKey: ['finance-pending-invoices'] });

      setModalConfig({
        isOpen: true,
        title: 'Reimbursement Submitted',
        message: 'Your reimbursement claim has been submitted and is pending approval.',
        type: 'success',
      });
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: 'Submission Failed',
        message: err.response?.data?.message || err.message || 'Failed to submit reimbursement.',
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Raise Reimbursement</h1>
      </div>

      <section className="border-b border-[var(--color-bg-border)] pb-6">
        <div className="pb-4 border-b border-[var(--color-bg-border)] mb-6">
          <h3 className="tm-widget-label flex items-center gap-2">
            <Receipt size={14} className="text-blue-500" /> Reimbursement Details
          </h3>
        </div>
        <div className="space-y-6">
          <Input
            label="Title *"
            value={form.title}
            onChange={(e) => patchForm({ title: e.target.value })}
            icon={FileText}
          />
          {fieldErrors.title && <p className="text-xs text-rose-500 -mt-4">{fieldErrors.title}</p>}

          <Input
            label="Description"
            value={form.description}
            onChange={(e) => patchForm({ description: e.target.value })}
          />

          <WorkspaceProjectFields
            projects={projects}
            workspace={form.workspace}
            projectId={form.projectId}
            onChange={({ workspace, projectId }) => patchForm({ workspace, projectId })}
            layout="inline"
            allowEmptyProject
            emptyProjectLabel="No Project"
          />

          <div className="p-4 bg-slate-100/60 dark:bg-slate-800/25 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                Expense Details
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Required for processing
              </span>
            </div>

            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                Merchant / Expense Description
                <span title="Where the expense was incurred"><Info size={10} /></span>
              </label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => patchForm({ vendor: e.target.value })}
                placeholder="e.g. Uber, Amazon, Office supplies"
                className={compactInputClass}
              />
            </div>

            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                Total Amount (INR) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amountInr}
                onChange={(e) => patchForm({ amountInr: e.target.value })}
                className={compactInputClass}
              />
              {fieldErrors.amountInr && <p className="text-xs text-rose-500 mt-1">{fieldErrors.amountInr}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                  Tax (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax}
                  onChange={(e) => patchForm({ tax: e.target.value })}
                  placeholder="Optional"
                  className={compactInputClass}
                />
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
                  Expense Date *
                </label>
                <input
                  type="date"
                  value={form.docDate}
                  onChange={(e) => patchForm({ docDate: e.target.value })}
                  required
                  className={compactInputClass}
                />
                {fieldErrors.docDate && <p className="text-xs text-rose-500 mt-1">{fieldErrors.docDate}</p>}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-2 block">
              Receipts / Proof * <span className="normal-case font-medium">(at least one, multiple allowed)</span>
            </label>
            <div className="p-4 border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-workspace)] space-y-3">
              <input
                ref={receiptFileRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={handleReceiptSelect}
                className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--color-action-primary)] file:text-white hover:file:bg-[var(--color-action-primary-hover)] file:cursor-pointer"
              />
              {receiptFiles.length > 0 && (
                <ul className="space-y-2">
                  {receiptFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]"
                    >
                      <span className="text-xs text-[var(--color-text-primary)] font-medium truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeReceiptFile(index)}
                        className="text-[var(--color-text-muted)] hover:text-rose-500 shrink-0"
                        title="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {fieldErrors.file && <p className="text-xs text-rose-500 mt-1">{fieldErrors.file}</p>}
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--color-bg-border)]">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.title.trim() || receiptFiles.length === 0 || !form.amountInr || !form.docDate}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Upload size={16} />
              {submitting ? 'Submitting...' : 'Submit Reimbursement'}
            </Button>
          </div>
        </div>
      </section>

      {(reimbursementsLoading || reimbursementsError || myReimbursements.length > 0) && (
        <section className="pt-2">
          <div className="pb-4 border-b border-[var(--color-bg-border)]">
            <h3 className="tm-widget-label flex items-center gap-2">
              <Clock size={14} className="text-amber-500" /> Your Reimbursements
            </h3>
          </div>
          <QueryErrorSlot
            isError={reimbursementsError}
            error={reimbursementsErr}
            onRetry={() => refetchReimbursements()}
            fallback="Failed to load reimbursements"
            className="mb-3"
          />
          <DataTable
            columns={reimbursementColumns}
            data={myReimbursements}
            isLoading={reimbursementsLoading}
            getRowId={(item) => item._id}
            paginated={myReimbursements.length > 10}
            emptyTitle="No reimbursements"
          />
          <p className="px-4 py-3 text-[10px] tm-data-meta border-t border-[var(--color-bg-border)]">
            Pending claims appear here until ops approves them on the Finance page.
          </p>
        </section>
      )}

      <NexusModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
}
