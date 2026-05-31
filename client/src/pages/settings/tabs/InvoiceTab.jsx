import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Receipt, FileText, Upload } from 'lucide-react';
import { Card, Input, Button, NexusModal } from '../../../components/ui';
import { uploadFiles } from '../../../utils/uploadthing';

export default function InvoiceTab() {
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const invoiceFileRef = useRef(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const handleInvoiceFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setInvoiceFile(file);
  };

  const handleSubmitInvoice = async () => {
    if (!invoiceTitle.trim()) return alert('Invoice title is required');
    if (!invoiceFile) return alert('Please attach an invoice file');

    setInvoiceSubmitting(true);
    try {
      const uploadRes = await uploadFiles('financeDocUploader', {
        files: [invoiceFile],
        headers: { authorization: `Bearer ${localStorage.getItem('coreknot_token')}` },
      });

      const uploaded = uploadRes?.[0];
      if (!uploaded?.url) throw new Error('File upload failed');

      await axios.post('/api/finance/submit-invoice', {
        title: invoiceTitle.trim(),
        amount: invoiceAmount,
        description: invoiceDescription.trim(),
        fileUrl: uploaded.url,
        fileKey: uploaded.key,
        fileName: uploaded.name || invoiceFile.name,
        fileSize: uploaded.size || invoiceFile.size,
        fileType: invoiceFile.type,
      });

      setInvoiceTitle('');
      setInvoiceAmount('');
      setInvoiceDescription('');
      setInvoiceFile(null);
      if (invoiceFileRef.current) invoiceFileRef.current.value = '';

      setModalConfig({ isOpen: true, title: 'Invoice Submitted', message: 'Your invoice has been submitted and is pending approval.', type: 'success' });
    } catch (err) {
      setModalConfig({ isOpen: true, title: 'Submission Failed', message: err.response?.data?.message || err.message || 'Failed to submit invoice.', type: 'danger' });
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Raise Invoice</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Submit your invoices for processing.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Receipt size={14} className="text-blue-500" /> Invoice Details
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Title" value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} icon={FileText} />
            <Input label="Amount (INR)" type="text" inputMode="decimal" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <Input label="Description" value={invoiceDescription} onChange={(e) => setInvoiceDescription(e.target.value)} />
          
          <div className="pt-2">
            <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-2 block">Invoice Document</label>
            <div className="flex items-center gap-4 p-4 border border-dashed border-[var(--color-bg-border)] rounded-xl bg-[var(--color-bg-workspace)]">
              <input
                ref={invoiceFileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={handleInvoiceFileSelect}
                className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--color-action-primary)] file:text-white hover:file:bg-[var(--color-action-primary-hover)] file:cursor-pointer"
              />
              {invoiceFile && (
                <span className="text-xs text-[var(--color-text-primary)] font-medium truncate max-w-[200px]">{invoiceFile.name}</span>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t border-[var(--color-bg-border)]">
            <Button
              onClick={handleSubmitInvoice}
              disabled={invoiceSubmitting || !invoiceTitle.trim() || !invoiceFile}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Upload size={16} />
              {invoiceSubmitting ? 'Submitting...' : 'Submit Invoice'}
            </Button>
          </div>
        </div>
      </Card>
      
      <NexusModal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} title={modalConfig.title} message={modalConfig.message} type={modalConfig.type} />
    </div>
  );
}
