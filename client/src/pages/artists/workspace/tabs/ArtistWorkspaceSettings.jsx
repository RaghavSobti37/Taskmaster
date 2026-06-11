import React, { useEffect, useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { Card, Input, Button } from '../../../../components/ui';
import { useUpdateArtist } from '../../../../hooks/queries/artists';
import ProfileTab from '../../../settings/tabs/ProfileTab';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ArtistWorkspaceSettings({ artistId, artist }) {
  const updateArtist = useUpdateArtist();
  const [slug, setSlug] = useState(artist?.slug || '');
  const [slugError, setSlugError] = useState('');
  const [slugSaved, setSlugSaved] = useState(false);

  useEffect(() => {
    setSlug(artist?.slug || '');
  }, [artist?.slug]);

  const publicUrl = slug ? `${window.location.origin}/artist/${slug}` : null;

  const handleSlugSave = async (e) => {
    e.preventDefault();
    const normalized = slugify(slug);
    if (!normalized) {
      setSlugError('Enter a valid URL slug (letters, numbers, hyphens)');
      return;
    }
    setSlugError('');
    setSlugSaved(false);
    try {
      await updateArtist.mutateAsync({ id: artistId, data: { slug: normalized } });
      setSlug(normalized);
      setSlugSaved(true);
    } catch (err) {
      setSlugError(err.response?.data?.message || err.message || 'Could not save slug');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6 rounded-2xl border border-[var(--color-bg-border)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 flex items-center gap-2">
          <Link2 size={12} /> Public profile URL
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Share this link for bookings and your public artist page.
        </p>
        <form onSubmit={handleSlugSave} className="space-y-3">
          <Input
            label="Profile slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugSaved(false);
              setSlugError('');
            }}
            placeholder="artist-name"
            hint="/artist/your-slug"
            error={slugError}
          />
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline"
            >
              <ExternalLink size={12} /> {publicUrl}
            </a>
          )}
          <Button type="submit" size="sm" disabled={updateArtist.isPending}>
            {updateArtist.isPending ? 'Saving…' : 'Save slug'}
          </Button>
          {slugSaved && (
            <p className="text-xs text-emerald-600 font-medium">Public URL updated.</p>
          )}
        </form>
      </Card>

      <Card className="p-4 sm:p-6 rounded-2xl border border-[var(--color-bg-border)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
          Your profile
        </p>
        <ProfileTab />
      </Card>
    </div>
  );
}
