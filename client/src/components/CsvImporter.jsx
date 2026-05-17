import React, { useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, CheckCircle2, ArrowRight, RefreshCw, Database, Layers } from 'lucide-react';
import { Card, Button, Badge } from './ui';

export default function CsvImporter({ onImportComplete }) {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  const systemFields = ['email', 'name', 'location', 'artistType', 'tags'];

  const handleFileChange = (e) => {
    if (!e.target.files?.[0]) return;
    Papa.parse(e.target.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const detectedHeaders = Object.keys(results.data[0]);
          setHeaders(detectedHeaders);
          setCsvData(results.data);
          
          // Auto-match headers to system fields if names match exactly or closely
          const initialMapping = {};
          systemFields.forEach(field => {
            const match = detectedHeaders.find(h => h.toLowerCase().trim() === field.toLowerCase() || h.toLowerCase().includes(field));
            if (match) initialMapping[field] = match;
          });
          setMapping(initialMapping);
          setImportStatus(null);
        }
      }
    });
  };

  const submitImport = async () => {
    if (!mapping.email) {
      alert('Email field mapping is mandatory.');
      return;
    }

    setIsImporting(true);
    setImportStatus(null);

    const standardizedLeads = csvData.map(row => {
      const lead = { metadata: {} };
      Object.keys(mapping).forEach(systemKey => {
        const csvCol = mapping[systemKey];
        if (!csvCol || !row[csvCol]) return;

        const val = row[csvCol].toString().trim();
        if (systemKey === 'tags') {
          lead[systemKey] = val.split(',').map(t => t.trim()).filter(Boolean);
        } else if (systemFields.includes(systemKey)) {
          lead[systemKey] = val;
        } else {
          lead.metadata[systemKey] = val;
        }
      });
      return lead;
    });

    try {
      const res = await axios.post('/api/crm/import-leads', { leads: standardizedLeads });
      setImportStatus({ success: true, count: res.data.processed || standardizedLeads.length });
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Import error:', err);
      setImportStatus({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-action-primary)]/10 border border-[var(--color-action-primary)]/20 flex items-center justify-center text-[var(--color-action-primary)] font-black uppercase">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">High-Density CSV Pipeline</h3>
            <p className="text-[11px] text-[var(--color-text-muted)] font-mono">Dynamic ingestion matrix with de-duplicated upsert engine</p>
          </div>
        </div>
        {csvData.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => { setCsvData([]); setHeaders([]); setMapping({}); setImportStatus(null); }} className="text-rose-500 hover:bg-rose-500/10">
            Reset Matrix
          </Button>
        )}
      </div>

      {csvData.length === 0 && (
        <label className="w-full cursor-pointer flex flex-col items-center justify-center p-12 bg-[var(--color-bg-secondary)] border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl hover:border-[var(--color-action-primary)] transition-all group">
          <Upload size={36} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors mb-3" />
          <span className="text-xs font-black uppercase tracking-widest mb-1">Select or drop CSV file</span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">Standard comma-separated layout support</span>
          <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        </label>
      )}

      {headers.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {importStatus && (
            <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono ${importStatus.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{importStatus.success ? `Successfully upserted ${importStatus.count} de-duplicated records.` : `Import failed: ${importStatus.error}`}</span>
              </div>
            </div>
          )}

          <div className="bg-[var(--color-bg-secondary)] p-4 rounded-2xl border border-[var(--color-bg-border)] space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <Layers size={14} /> Column Mapping Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {systemFields.map(field => (
                <div key={field} className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-primary)] flex items-center justify-between">
                    <span>{field}</span>
                    {field === 'email' && <span className="text-rose-500 text-[9px] font-mono">Mandatory</span>}
                  </label>
                  <select 
                    className="bg-[var(--color-bg-primary)] p-2.5 rounded-xl border border-[var(--color-bg-border)] text-xs font-mono outline-none focus:border-[var(--color-action-primary)] transition-all"
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                  >
                    <option value="">-- Match CSV Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="pt-3">
              <Button onClick={submitImport} disabled={isImporting || !mapping.email} className="w-full py-3" variant="primary">
                {isImporting ? <RefreshCw className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                Execute Deduplicated Upsert ({csvData.length} Records)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">
              <span>Data Preview Matrix ({Math.min(5, csvData.length)} of {csvData.length})</span>
              <Badge variant="info">{headers.length} Columns</Badge>
            </div>
            <div className="border border-[var(--color-bg-border)] rounded-xl overflow-x-auto bg-[var(--color-bg-secondary)] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)]">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="px-3 py-2 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {csvData.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[var(--color-bg-primary)]/50">
                      {headers.map(h => (
                        <td key={h} className="px-3 py-2 text-[11px] truncate max-w-[150px]">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
