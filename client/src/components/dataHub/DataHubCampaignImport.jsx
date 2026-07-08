import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Upload, RefreshCw } from 'lucide-react';
import { Button } from '../ui';

export default function DataHubCampaignImport({ onImported, compact = false, className = '' }) {
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleSyncCatalog = async () => {
    setSyncing(true);
    try {
      const res = await axios.post('/api/data-hub/campaign-outcomes/sync-aisensy');
      const stats = res.data?.stats || {};
      const outcomes = res.data?.outcomes;
      alert(
        `Prod sync: ${stats.campaignsUpserted ?? 0} campaigns, `
        + `${stats.outcomeRowsImported ?? outcomes?.imported ?? 0} user rows from `
        + `${stats.exportFiles ?? outcomes?.filesFound ?? 0} CSV(s). Open Campaigns panel to browse.`,
      );
      onImported?.();
    } catch (err) {
      alert('AiSensy catalog sync failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  };

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
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      <Button
        variant="secondary"
        size="sm"
        className="!px-2.5 whitespace-nowrap w-full justify-start"
        onClick={handleSyncCatalog}
        disabled={syncing || importing}
        title="Sync AiSensy catalog + import audience CSVs from Downloads (production only)"
      >
        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing…' : (compact ? 'AiSensy sync' : 'Sync AiSensy catalog')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="!px-2.5 whitespace-nowrap w-full justify-start"
        onClick={handlePick}
        disabled={importing || syncing}
        title="Import AiSensy campaign CSV (failed/delivered/read)"
      >
        <Upload size={14} />
        {importing ? 'Importing…' : (compact ? 'WA campaign' : 'Import WA Campaign')}
      </Button>
    </div>
  );
}
