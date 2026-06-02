import React from 'react';
import { Edit2, Trash2, Globe, Link as LinkIcon } from 'lucide-react';
import { Card, Input, Button, FullScreenWorkspace } from '../ui';
import { stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';
import ConnectAccountButton from './ConnectAccountButton';
import { analyticsIntegrations } from '../../config/integrations.config';

export default function ArtistEditDrawer({
  isOpen,
  onClose,
  artist,
  editedArtist,
  setEditedArtist,
  onSave,
  onDelete,
  isPreview,
}) {
  if (!artist || !editedArtist) return null;

  return (
    <FullScreenWorkspace
      isOpen={isOpen}
      onClose={onClose}
      title={artist.name || 'Artist Profile'}
      subtitle={`Workspace ID · ${artist._id}`}
      onSave={onSave}
      hasChanges={!stableJsonEqual(editedArtist, artist)}
      onCancel={() => setEditedArtist(cloneSnapshot(artist))}
      sidebar={
        !isPreview && (
          <Card className="p-4 space-y-4 border-rose-500/20">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500">Danger Zone</h4>
            <p className="text-[11px] text-slate-500">Permanently remove artist and disconnect all integrations.</p>
            <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
              <Trash2 size={14} /> Delete Artist
            </Button>
          </Card>
        )
      }
    >
      <div className="space-y-8 max-w-3xl">
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Edit2 size={14} /> General Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Artist Name" value={editedArtist.name} onChange={(e) => setEditedArtist({ ...editedArtist, name: e.target.value })} />
            <Input label="Website" value={editedArtist.website} onChange={(e) => setEditedArtist({ ...editedArtist, website: e.target.value })} icon={Globe} />
            <div className="md:col-span-2">
              <Input label="Bio" multiline rows={4} value={editedArtist.bio} onChange={(e) => setEditedArtist({ ...editedArtist, bio: e.target.value })} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <LinkIcon size={14} /> Platform IDs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Spotify Artist ID" value={editedArtist.spotifyId} onChange={(e) => setEditedArtist({ ...editedArtist, spotifyId: e.target.value })} className="font-mono text-xs" />
            <Input label="YouTube Channel ID" value={editedArtist.youtubeId} onChange={(e) => setEditedArtist({ ...editedArtist, youtubeId: e.target.value })} className="font-mono text-xs" />
            <Input label="Instagram Graph ID" value={editedArtist.instaId} onChange={(e) => setEditedArtist({ ...editedArtist, instaId: e.target.value })} className="font-mono text-xs" />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Connect Accounts</h3>
          <div className="flex flex-wrap gap-2">
            {analyticsIntegrations().filter((p) => p.hasOAuth).map((p) => (
              <ConnectAccountButton key={p.id} provider={p.id} artistId={artist._id} />
            ))}
          </div>
        </section>
      </div>
    </FullScreenWorkspace>
  );
}
