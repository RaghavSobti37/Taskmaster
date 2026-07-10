import React, { useState } from 'react';
import { formatDisplayDateTime } from '../../../utils/dateDisplay';
import { Card, Button, Input } from '../../../components/ui';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { Plus } from 'lucide-react';
import { useArtistOsNotes, useCreateArtistNote } from '../../../hooks/queries/artistOs';

export default function ArtistNotesTab({ artistId, isPreview }) {
  const { data: notes = [], isLoading, isError, error, refetch } = useArtistOsNotes(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistNote();
  const [body, setBody] = useState('');

  const add = async () => {
    if (!body.trim()) return;
    await createMutation.mutateAsync({ artistId, data: { body: body.trim() } });
    setBody('');
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      {!isPreview && (
        <Card className="p-4 space-y-2">
          <Input label="Team note" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" onClick={add} disabled={createMutation.isPending}><Plus size={14} /> Add Note</Button>
        </Card>
      )}
      {notes.length === 0 ? (
        <Card className="p-6 text-center text-xs text-[var(--color-text-muted)]">No team notes yet.</Card>
      ) : (
        notes.map((n) => (
          <Card key={n._id} className="p-4">
            <p className="text-xs whitespace-pre-wrap">{n.body}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
              {n.authorName || 'Team'} · {formatDisplayDateTime(n.createdAt)}
            </p>
          </Card>
        ))
      )}
    </ArtistOsQueryShell>
  );
}
