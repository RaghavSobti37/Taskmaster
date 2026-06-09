import React, { useState } from 'react';
import axios from 'axios';
import { Upload } from 'lucide-react';
import { Button, Card } from '../ui';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { crmQueryParamsForUser } from '../../utils/crmScope';
import { useAuth } from '../../contexts/AuthContext';

export default function ArtistCrmImportPanel({ compact = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const { data } = await axios.post('/api/crm/artist/upload', formData);
      toast.success(`Imported ${data.imported} contacts (${data.skipped} skipped)`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'imports'] });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (compact) {
    return (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border border-[var(--color-bg-border)]">
            <Upload size={12} /> {uploading ? '…' : 'Import CSV'}
          </span>
        </label>
    );
  }

  return (
    <Card className="p-4 border border-dashed border-[var(--color-bg-border)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Artist CRM Import</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Upload YUGM media, Harshad Duhita sheets, or Event Database CSV — template auto-detected from filename.
          </p>
        </div>
        <label className="inline-flex cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-action-primary)] text-white opacity-100 disabled:opacity-50">
            <Upload size={14} /> {uploading ? 'Importing…' : 'Upload CSV'}
          </span>
        </label>
      </div>
    </Card>
  );
}

export function useArtistCrmImportQueryKey() {
  const { user } = useAuth();
  return crmQueryParamsForUser(user, {});
}
