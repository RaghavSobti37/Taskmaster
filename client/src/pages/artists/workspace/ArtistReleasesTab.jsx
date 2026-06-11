import React, { useState } from 'react';
import { Disc, ExternalLink, Plus, Trash2, TrendingUp } from 'lucide-react';
import { Card, Button, Input, DataTable } from '../../../components/ui';
import ArtistOsQueryShell from '../os/ArtistOsQueryShell';
import { NexusModal } from '../../../components/ui/modals';
import { formatNumber } from '../../../config/integrations.config';
import {
  useArtistOsReleases,
  useCreateArtistRelease,
  useUpdateArtistRelease,
  useDeleteArtistRelease,
} from '../../../hooks/queries/artistOs';

const EMPTY = {
  title: '',
  releaseDate: '',
  distributor: '',
  upc: '',
  isrc: '',
  spotify: '',
  apple: '',
  youtube: '',
  campaignNotes: '',
};

function dspUrl(release, platform) {
  return (release.dspLinks || []).find((l) => l.platform === platform)?.url;
}

export default function ArtistReleasesTab({ artistId, isPreview }) {
  const { data: items = [], isLoading, isError, error, refetch } = useArtistOsReleases(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistRelease();
  const updateMutation = useUpdateArtistRelease();
  const deleteMutation = useDeleteArtistRelease();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title,
      releaseDate: row.releaseDate ? new Date(row.releaseDate).toISOString().slice(0, 10) : '',
      distributor: row.distributor || '',
      upc: row.upc || '',
      isrc: row.isrc || '',
      spotify: dspUrl(row, 'spotify') || '',
      apple: dspUrl(row, 'apple') || '',
      youtube: dspUrl(row, 'youtube') || '',
      campaignNotes: row.campaignNotes || '',
    });
    setOpen(true);
  };

  const columns = [
    {
      header: 'Release',
      render: (row) => (
        <div>
          <p className="text-xs font-bold">{row.title}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{row.distributor || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Date',
      render: (row) => (
        <span className="text-xs">{row.releaseDate ? new Date(row.releaseDate).toLocaleDateString('en-IN') : '—'}</span>
      ),
    },
    {
      header: 'Codes',
      render: (row) => (
        <div className="text-[10px] text-[var(--color-text-muted)]">
          {row.upc && <p>UPC {row.upc}</p>}
          {row.isrc && <p>ISRC {row.isrc}</p>}
          {!row.upc && !row.isrc && '—'}
        </div>
      ),
    },
    {
      header: 'DSP',
      render: (row) => (
        <div className="flex gap-2">
          {['spotify', 'apple', 'youtube'].map((p) => {
            const url = dspUrl(row, p);
            if (!url) return null;
            return (
              <a key={p} href={url} target="_blank" rel="noreferrer" className="text-[10px] uppercase font-bold text-[var(--color-action-primary)]" onClick={(e) => e.stopPropagation()}>
                {p} <ExternalLink size={10} className="inline" />
              </a>
            );
          })}
        </div>
      ),
    },
    {
      header: 'Analytics',
      render: (row) => {
        const a = row.analytics;
        if (!a?.hasCorrelation) return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>;
        return (
          <div className="text-[10px] space-y-0.5">
            {a.spotifyDelta != null && (
              <p className="flex items-center gap-1 font-bold text-emerald-600">
                <TrendingUp size={12} />
                {a.spotifyDelta >= 0 ? '+' : ''}{formatNumber(a.spotifyDelta)} followers
              </p>
            )}
            {a.spotifyStreams != null && <p>Spotify {formatNumber(a.spotifyStreams)} streams</p>}
            {a.youtubeViews != null && <p>YouTube {formatNumber(a.youtubeViews)} views</p>}
          </div>
        );
      },
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
            if (window.confirm('Delete this release?')) {
              deleteMutation.mutate({ artistId, releaseId: row._id });
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
    if (!form.title || !form.releaseDate) return alert('Title and release date required');
    const payload = {
      title: form.title,
      releaseDate: form.releaseDate,
      distributor: form.distributor || undefined,
      upc: form.upc || undefined,
      isrc: form.isrc || undefined,
      campaignNotes: form.campaignNotes || undefined,
      dspLinks: {
        spotify: form.spotify,
        apple: form.apple,
        youtube: form.youtube,
      },
    };
    if (editing) {
      await updateMutation.mutateAsync({ artistId, releaseId: editing._id, data: payload });
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
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Disc size={16} />
          <p className="text-xs font-bold">
            Release Tracker — rollout dates, distributor codes, DSP links, and analytics correlation when data exists.
          </p>
        </div>
      </Card>

      {!isPreview && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}><Plus size={14} /> Add Release</Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        emptyTitle="No releases tracked"
        onRowClick={!isPreview ? openEdit : undefined}
      />

      {!items.length && (
        <Card className="p-4 text-xs text-[var(--color-text-muted)]">
          Track singles, EPs, and albums to correlate streaming growth with bookings and revenue.
        </Card>
      )}

      <NexusModal isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit Release' : 'Add Release'} showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Release Date *" type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
          <Input label="Distributor" value={form.distributor} onChange={(e) => setForm({ ...form, distributor: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="UPC" value={form.upc} onChange={(e) => setForm({ ...form, upc: e.target.value })} />
            <Input label="ISRC" value={form.isrc} onChange={(e) => setForm({ ...form, isrc: e.target.value })} />
          </div>
          <Input label="Spotify URL" value={form.spotify} onChange={(e) => setForm({ ...form, spotify: e.target.value })} />
          <Input label="Apple Music URL" value={form.apple} onChange={(e) => setForm({ ...form, apple: e.target.value })} />
          <Input label="YouTube URL" value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
          <Input label="Notes" value={form.campaignNotes} onChange={(e) => setForm({ ...form, campaignNotes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Save</Button>
          </div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
