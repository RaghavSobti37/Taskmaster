import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Button, Input, DataTable, Badge } from '../../../components/ui';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { NexusModal } from '../../../components/ui/modals';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { ASSET_TYPES } from './artistOsConstants';
import {
  useArtistOsAssets,
  useCreateArtistAsset,
  useUpdateArtistAsset,
  useDeleteArtistAsset,
} from '../../../hooks/queries/artistOs';

const EMPTY = { type: 'artwork', title: '', url: '', tags: '' };

export default function ArtistContentTab({ artistId, isPreview }) {
  const { data: items = [], isLoading, isError, error, refetch } = useArtistOsAssets(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistAsset();
  const updateMutation = useUpdateArtistAsset();
  const deleteMutation = useDeleteArtistAsset();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return items;
    return items.filter((row) => row.type === typeFilter);
  }, [items, typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      type: row.type,
      title: row.title,
      url: row.url,
      tags: (row.tags || []).join(', '),
    });
    setOpen(true);
  };

  const columns = [
    {
      header: 'Asset',
      render: (row) => (
        <div>
          <p className="text-xs font-bold">{row.title}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase">{row.type}</p>
        </div>
      ),
    },
    {
      header: 'Link',
      render: (row) => (
        row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--color-action-primary)] inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Open <ExternalLink size={12} />
          </a>
        ) : <span className="text-xs text-[var(--color-text-muted)]">—</span>
      ),
    },
    {
      header: 'Tags',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.tags || []).slice(0, 3).map((tag) => (
            <Badge key={tag} variant="slate">{tag}</Badge>
          ))}
        </div>
      ),
    },
    {
      header: '',
      render: (row) => !isPreview && (
        <button
          type="button"
          className="text-rose-500 hover:text-rose-600 p-1"
          disabled={deleteMutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Delete this asset?')) {
              deleteMutation.mutate({ artistId, assetId: row._id });
            }
          }}
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.url) {
      toast.error('Title and URL required');
      return;
    }
    const payload = {
      type: form.type,
      title: form.title,
      url: form.url,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    if (editing) {
      await updateMutation.mutateAsync({ artistId, assetId: editing._id, data: payload });
    } else {
      await createMutation.mutateAsync({ artistId, data: payload });
    }
    setOpen(false);
    setForm(EMPTY);
    setEditing(null);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      <Card className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--token-surface-2)]/50">
        <p className="text-xs font-bold text-[var(--color-text-muted)]">
          Content Hub — store artwork, EPK, press kits, and brand assets. Paste a URL for now; file upload uses org upload flow when wired.
        </p>
      </Card>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${typeFilter === 'all' ? 'bg-[var(--token-surface-2)] border border-[var(--color-bg-border)]' : 'text-[var(--color-text-muted)]'}`}
        >
          All
        </button>
        {ASSET_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTypeFilter(t.id)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${typeFilter === t.id ? 'bg-[var(--token-surface-2)] border border-[var(--color-bg-border)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!isPreview && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}><Plus size={14} /> Add Asset</Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="No content assets yet"
        onRowClick={!isPreview ? openEdit : undefined}
      />

      <NexusModal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Asset' : 'Add Asset'} showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <label className="text-xs font-bold block">
            Type
            <select className="w-full mt-1 border rounded px-2 py-1.5 text-xs" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="URL *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          <Input label="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Save</Button>
          </div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
