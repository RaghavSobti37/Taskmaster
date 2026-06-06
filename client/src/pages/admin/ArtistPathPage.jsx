import React, { useState } from 'react';
import { RefreshCw, Upload, Music, Search } from 'lucide-react';
import { PageContainer, Button } from '../../components/ui/primitives';
import SearchInput from '../../components/ui/SearchInput';
import PageToolbar from '../../components/ui/PageToolbar';
import ArtistPathCardGrid from '../../components/artistPath/ArtistPathCardGrid';
import ArtistPathProfileSlider from '../../components/artistPath/ArtistPathProfileSlider';
import {
  useArtistPathPeople,
  useArtistPathSync,
  useArtistPathUpload,
} from '../../hooks/queries/artistPath';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../contexts/ToastContext';

export default function ArtistPathPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const fileRef = React.useRef(null);

  const { data, isLoading, refetch, isFetching } = useArtistPathPeople({
    page,
    limit: 24,
    search: debouncedSearch || undefined,
  });
  const syncMutation = useArtistPathSync();
  const uploadMutation = useArtistPathUpload();

  const handleSync = async () => {
    try {
      const res = await syncMutation.mutateAsync();
      toast.success(`Synced ${res.data?.imported ?? 0} responses`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMutation.mutateAsync(file);
      toast.success(`Imported ${res.data?.imported ?? 0} rows`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      e.target.value = '';
    }
  };

  const totalPages = data?.pages || 0;

  return (
    <PageContainer>
      <PageToolbar
        title="Artist Path"
        subtitle="Questionnaire respondents from the Artist Path Google Sheet"
        icon={Music}
        actions={(
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload size={14} /> Upload CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} /> Sync Sheet
            </Button>
          </>
        )}
      />

      <div className="mb-4 max-w-md">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, phone…"
          icon={Search}
        />
      </div>

      <ArtistPathCardGrid
        people={data?.data || []}
        loading={isLoading || isFetching}
        onSelect={setSelectedId}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
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

      <ArtistPathProfileSlider personId={selectedId} onClose={() => setSelectedId(null)} />
    </PageContainer>
  );
}
