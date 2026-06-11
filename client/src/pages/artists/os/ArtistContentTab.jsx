import React, { useState } from 'react';
import { Card, Button, Input, DataTable } from '../../../components/ui';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { NexusModal } from '../../../components/ui/modals';
import { Plus } from 'lucide-react';
import { useArtistOsContent, useCreateArtistContent } from '../../../hooks/queries/artistOs';

const EMPTY = { title: '', releaseType: 'single', releaseDate: '', spotifyStreams: '', youtubeViews: '' };

export default function ArtistContentTab({ artistId, isPreview }) {
  const { data: items = [], isLoading, isError, error, refetch } = useArtistOsContent(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistContent();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const columns = [
    { header: 'Release', render: (row) => <span className="text-xs font-bold">{row.title}</span> },
    { header: 'Type', render: (row) => <span className="text-xs uppercase">{row.releaseType}</span> },
    {
      header: 'Date',
      render: (row) => <span className="text-xs">{new Date(row.releaseDate).toLocaleDateString('en-IN')}</span>,
    },
    { header: 'Spotify', render: (row) => <span className="text-xs">{row.spotifyStreams ?? 0}</span> },
    { header: 'YouTube', render: (row) => <span className="text-xs">{row.youtubeViews ?? 0}</span> },
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.releaseDate) return alert('Title and date required');
    await createMutation.mutateAsync({
      artistId,
      data: {
        title: form.title,
        releaseType: form.releaseType,
        releaseDate: form.releaseDate,
        spotifyStreams: Number(form.spotifyStreams) || 0,
        youtubeViews: Number(form.youtubeViews) || 0,
      },
    });
    setOpen(false);
    setForm(EMPTY);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      {!isPreview && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add Release</Button>
        </div>
      )}
      <DataTable columns={columns} data={items} emptyTitle="No releases tracked" />
      {!items.length && (
        <Card className="p-4 text-xs text-[var(--color-text-muted)]">
          Track releases to correlate Spotify growth with gig inquiries and revenue.
        </Card>
      )}
      <NexusModal isOpen={open} onClose={() => setOpen(false)} title="Add Release" showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Song / Release *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Type" value={form.releaseType} onChange={(e) => setForm({ ...form, releaseType: e.target.value })} />
          <Input label="Release Date *" type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
          <Input label="Spotify Streams" type="number" value={form.spotifyStreams} onChange={(e) => setForm({ ...form, spotifyStreams: e.target.value })} />
          <Input label="YouTube Views" type="number" value={form.youtubeViews} onChange={(e) => setForm({ ...form, youtubeViews: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
