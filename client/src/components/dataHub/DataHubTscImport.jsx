import React, { useState } from 'react';
import axios from 'axios';
import { Upload, ArrowRight, X } from 'lucide-react';
import { Button, NexusModal, NexusDropdown, ModalShell, ModalHeader, ModalBody } from '../ui';

const TSC_FIELDS = [
  'name', 'email', 'phone', 'city', 'state', 'role', 'campaign',
  'originSource', 'dataType', 'destination', 'timestamp', 'mediaUrl', 'sourceFilename',
];

export default function DataHubTscImport({ onImported, compact = false }) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sample, setSample] = useState([]);
  const [tempPath, setTempPath] = useState('');
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    try {
      const res = await axios.post('/api/tsc/upload', formData);
      setHeaders(res.data.headers);
      setSample(res.data.sample);
      setTempPath(res.data.tempPath);
      setRowCount(res.data.rowCount);
      setImportFile(file);
      const initialMapping = {};
      res.data.headers.forEach((h) => { initialMapping[h] = 'metadata'; });
      setMapping(initialMapping);
      setImportStep(2);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  const handleImportExecute = async () => {
    setImporting(true);
    try {
      await axios.post('/api/tsc/import', { mapping, tempPath, filename: importFile.name });
      setShowImportModal(false);
      setImportStep(1);
      onImported?.();
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" className="!px-2.5 whitespace-nowrap" onClick={() => setShowImportModal(true)} title="Import TSC / HolySheet CSV">
        <Upload size={14} />
        {compact ? 'Import' : 'Import TSC Data'}
      </Button>

      <NexusModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} size="lg">
        <ModalShell>
          <ModalHeader title="TSC / HolySheet Import" subtitle={`Step ${importStep} of 3`} onClose={() => setShowImportModal(false)} />
          <ModalBody>
            {importStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-text-muted)]">Upload CSV to import bulk marketing data into the TSC inlet.</p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-bg-border)] rounded-xl p-8 cursor-pointer hover:border-[var(--color-action-primary)] transition-colors">
                  <Upload size={32} className="text-[var(--color-text-muted)] mb-2" />
                  <span className="text-sm font-bold">Choose CSV file</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={importing} />
                </label>
              </div>
            )}

            {importStep === 2 && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-[var(--color-text-muted)]">{rowCount} rows detected. Map columns:</p>
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase w-32 truncate">{h}</span>
                    <ArrowRight size={12} className="text-[var(--color-text-muted)]" />
                    <NexusDropdown
                      className="flex-1"
                      value={mapping[h]}
                      onChange={(v) => setMapping({ ...mapping, [h]: v })}
                      options={[
                        { value: 'metadata', label: 'Metadata (extra)' },
                        { value: 'IGNORE', label: 'Ignore' },
                        ...TSC_FIELDS.map((f) => ({ value: f, label: f })),
                      ]}
                    />
                  </div>
                ))}
                {sample[0] && (
                  <pre className="text-[9px] bg-[var(--color-bg-secondary)] p-3 rounded-lg overflow-x-auto">{JSON.stringify(sample[0], null, 2)}</pre>
                )}
                <Button onClick={() => setImportStep(3)}>Continue</Button>
              </div>
            )}

            {importStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm">Ready to import <strong>{rowCount}</strong> records into TSC / HolySheet.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setImportStep(2)}>Back</Button>
                  <Button onClick={handleImportExecute} disabled={importing}>
                    {importing ? 'Importing…' : 'Execute Import'}
                  </Button>
                </div>
              </div>
            )}
          </ModalBody>
        </ModalShell>
      </NexusModal>
    </>
  );
}
