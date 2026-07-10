import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui/primitives';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

/** ponytail: CSV import UI stub — full column mapping when import spec lands */
export function OpsCsvImportButton({ domain, subtype, disabled }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !domain) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines.shift();
    if (!header) {
      toast.error('Empty CSV');
      return;
    }
    let imported = 0;
    for (const line of lines) {
      const [name, organization, city, email] = line.split(',').map((c) => c.trim());
      if (!name) continue;
      try {
        await axios.post('/api/ops-hub/entities', {
          domain,
          subtype: subtype || undefined,
          name,
          organization,
          city,
          email,
          status: 'new',
        });
        imported += 1;
      } catch {
        // skip bad rows
      }
    }
    queryClient.invalidateQueries({ queryKey: ['opsHub'] });
    toast.success(`Imported ${imported} record${imported === 1 ? '' : 's'}`);
    e.target.value = '';
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <Button size="sm" variant="secondary" disabled={disabled || !domain} onClick={() => inputRef.current?.click()}>
        <Upload size={14} className="mr-1" />
        Import CSV
      </Button>
    </>
  );
}
