import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Upload } from 'lucide-react';
import { Button } from '../ui';

export default function DataHubCampaignImport({ onImported, compact = false, className = '' }) {
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    try {
      const res = await axios.post('/api/data-hub/campaign-outcomes/import', formData);
      const stats = res.data?.stats;
      alert(`Imported ${stats?.imported ?? 0} rows for "${stats?.campaignName || file.name}" (${stats?.defaultStatus || 'status auto'})`);
      onImported?.();
    } catch (err) {
      alert('Campaign import failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      <Button
        variant="secondary"
        size="sm"
        className={`!px-2.5 whitespace-nowrap ${className}`.trim()}
        onClick={handlePick}
        disabled={importing}
        title="Import AiSensy campaign CSV (failed/delivered/read)"
      >
        <Upload size={14} />
        {importing ? 'Importing…' : (compact ? 'WA campaign' : 'Import WA Campaign')}
      </Button>
    </>
  );
}
