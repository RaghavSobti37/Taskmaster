import React, { useState, lazy, Suspense } from 'react';
import { RefreshCw, Music } from 'lucide-react';
import { PageContainer, Button } from '../../components/ui/primitives';
import SearchInput from '../../components/ui/SearchInput';
import PageToolbar from '../../components/ui/PageToolbar';
import ArtistPathCardGrid from '../../components/artistPath/ArtistPathCardGrid';
import { useArtistPathPeople, useArtistPathSync } from '../../hooks/queries/artistPath';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../contexts/ToastContext';
import ArtistProductHint from '../../components/brand/ArtistProductHint';

const ArtistPathProfileSlider = lazy(() => import('../../components/artistPath/ArtistPathProfileSlider'));

export default function ArtistPathPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading, refetch, isFetching, isError, error } = useArtistPathPeople({
    page,
    limit: 24,
    search: debouncedSearch || undefined,
  });
  const syncMutation = useArtistPathSync();

  const handleSync = async () => {
    try {
      const res = await syncMutation.mutateAsync();
      toast.success(`Synced ${res.data?.imported ?? 0} responses from sheet`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    }
  };

  const totalPages = data?.pages || 0;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageToolbar
        icon={Music}
        title="Artist Path"
        actions={(
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
            title="Pull latest rows from HolySheet (backfill / repair)"
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} /> Sync from Sheet
          </Button>
        )}
      />

      <p className="text-xs text-[var(--color-text-muted)] -mt-2 flex flex-wrap items-center gap-2">
        <span>Live submissions arrive via website webhook. HolySheet remains the source of truth; use sync only to backfill.</span>
        <ArtistProductHint product="artistPath" />
      </p>

      <div className="max-w-md">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
        />
      </div>

      {isError && (
        <p className="text-sm text-rose-500">
          {error?.response?.data?.error || 'Failed to load Artist Path data'}
        </p>
      )}

      <ArtistPathCardGrid
        people={data?.data || []}
        loading={isLoading || isFetching}
        onSelect={setSelectedId}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Page {page} of {totalPages} · {data?.total ?? 0} total
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Suspense fallback={null}>
        <ArtistPathProfileSlider
          key={selectedId || 'closed'}
          personId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      </Suspense>
    </PageContainer>
  );
}
