import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, ArrowRight, RefreshCw, Layers, UserCheck, Sparkles } from 'lucide-react';
import { Button, Card, Badge } from '../ui';
import { Modal } from '../ui/modals';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';

const CRM_FIELD_SELECT = 'w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:border-[var(--color-action-primary)]';

export default function ArtistCrmImportPanel({ compact = false }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState('upload');
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [assignees, setAssignees] = useState([]);
  const [assignedRepId, setAssignedRepId] = useState('');
  const [assigneeFromSheet, setAssigneeFromSheet] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    axios.get('/api/crm/artist/assignees')
      .then(({ data }) => {
        setAssignees(data || []);
        if (data?.length) setAssignedRepId(String(data[0]._id));
      })
      .catch(() => {});
  }, []);

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setMapping({});
    setFile(null);
    setAssigneeFromSheet(false);
  };

  const handleFilePick = async (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setLoading(true);
    const formData = new FormData();
    formData.append('file', picked);
    try {
      const { data } = await axios.post('/api/crm/artist/preview', formData);
      setPreview(data);
      setMapping(data.suggestedMapping || {});
      if (data.detectedAssignee?.assigneeId) {
        setAssignedRepId(String(data.detectedAssignee.assigneeId));
        setAssigneeFromSheet(true);
      } else {
        setAssigneeFromSheet(false);
      }
      setStep('map');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not read CSV');
      setFile(null);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const runImport = async () => {
    if (!file) return;
    if (!mapping.name) {
      toast.error('Map the Name column before importing.');
      return;
    }
    if (!mapping.phone && !mapping.email) {
      toast.error('Map at least Phone or Email.');
      return;
    }
    if (!assignedRepId) {
      toast.error('Choose who to assign leads to.');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    formData.append('assignedRepId', assignedRepId);
    formData.append('sheetName', preview.sheetName || file.name.replace(/\.csv$/i, ''));
    formData.append('useSheetAssignee', assigneeFromSheet ? 'true' : 'false');
    try {
      const { data } = await axios.post('/api/crm/artist/upload', formData);
      const count = data.imported ?? data.prepared ?? 0;
      const skipped = data.skipped ?? 0;
      const who = data.assignee || 'rep';
      const viaSheet = data.assigneeSource === 'sheet_name' ? ' (from sheet name)' : '';
      toast.success(`Imported ${count} leads to ${who}${viaSheet} — ${skipped} skipped`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'imports'] });
      reset();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const mapStep = step === 'map' && preview && (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[var(--color-text-muted)]">
        <Badge variant="info">{preview.filename}</Badge>
        <span>{preview.rowCount} rows</span>
        {preview.detectedAssignee && (
          <Badge variant="success">
            <Sparkles size={10} className="inline mr-1" />
            Assignee: {preview.detectedAssignee.assigneeName}
            {preview.detectedAssignee.source === 'sheet_rule' ? ' (sheet rule)' : ' (from sheet name)'}
          </Badge>
        )}
        {preview.detectedTemplate && (
          <Badge variant="info">Template: {preview.detectedTemplate}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] md:col-span-2">
          <Layers size={14} /> Column mapping
        </div>
        {(preview.fields || []).map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider flex justify-between">
              <span>{field.label}</span>
              {field.required && <span className="text-rose-500">Required</span>}
            </label>
            <select
              className={CRM_FIELD_SELECT}
              value={mapping[field.key] || ''}
              onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
            >
              <option value="">— CSV column —</option>
              {preview.headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-[var(--color-text-muted)]">
          <UserCheck size={12} /> Assign all new leads to
        </label>
        <select
          className={CRM_FIELD_SELECT}
          value={assignedRepId}
          onChange={(e) => {
            setAssignedRepId(e.target.value);
            setAssigneeFromSheet(false);
          }}
        >
          {assignees.map((rep) => (
            <option key={rep._id} value={rep._id}>{rep.name}</option>
          ))}
        </select>
        {assigneeFromSheet && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
            Sheet name matched — override above if needed.
          </p>
        )}
      </div>

      <Button
        onClick={runImport}
        disabled={importing || !mapping.name || (!mapping.phone && !mapping.email) || !assignedRepId}
        className="w-full"
        variant="primary"
      >
        {importing ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
        Import {preview.rowCount} rows
      </Button>
    </div>
  );

  if (compact) {
    return (
      <>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={handleFilePick} disabled={loading} />
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border border-[var(--color-bg-border)]">
            <Upload size={12} /> {loading ? '…' : 'Import CSV'}
          </span>
        </label>
        <Modal
          isOpen={step === 'map' && !!preview}
          onClose={reset}
          title="Import CSV"
          showFooter={false}
          size="xl"
        >
          {mapStep}
        </Modal>
      </>
    );
  }

  return (
    <Card className="p-4 border border-dashed border-[var(--color-bg-border)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Artist CRM Import</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 max-w-xl">
            Upload any CSV. If filename/sheet ends with <code className="font-mono text-[10px]">- Akash</code> (or Rohith, Atharva, Harshika…), leads auto-assign to that rep.
            Existing leads are skipped — nothing overwritten. Academy (sales) pipeline untouched.
          </p>
        </div>
        {step !== 'upload' && (
          <Button size="xs" variant="ghost" onClick={reset}>Reset</Button>
        )}
      </div>

      {step === 'upload' && (
        <label className="w-full cursor-pointer flex flex-col items-center justify-center p-8 bg-[var(--color-bg-secondary)] border-2 border-dashed border-[var(--color-bg-border)] rounded-xl hover:border-[var(--color-action-primary)] transition-all">
          <Upload size={28} className="text-[var(--color-text-muted)] mb-2" />
          <span className="text-xs font-bold uppercase tracking-wider">Select CSV to import</span>
          <span className="text-[10px] text-[var(--color-text-muted)] mt-1">Name file like <span className="font-mono">Leads - Akash.csv</span> to auto-assign</span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFilePick} disabled={loading} />
          {loading && <span className="text-[10px] mt-2 text-[var(--color-action-primary)]">Reading file…</span>}
        </label>
      )}

      {mapStep}
    </Card>
  );
}
