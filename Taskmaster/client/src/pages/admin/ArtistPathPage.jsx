import React, { useState, lazy, Suspense } from 'react';
import { RefreshCw, Music, Mail, Phone, MapPin, ExternalLink } from 'lucide-react';
import { PageContainer, Button, PageHeader, QueryErrorBanner, getQueryErrorMessage, Card, Badge } from '../../components/ui';
import SearchInput from '../../components/ui/SearchInput';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import ArtistPathCardGrid from '../../components/artistPath/ArtistPathCardGrid';
import ArtistPathAnswerSections from '../../components/artistPath/ArtistPathAnswerSections';
import { useArtistPathPeople, useArtistPathResponses, useArtistPathSync } from '../../hooks/queries/artistPath';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../contexts/ToastContext';
import ArtistProductHint from '../../components/brand/ArtistProductHint';
import { formatDisplayDateTime } from '../../utils/dateDisplay';
import { collectGroupedAnswers, displayRespondentName, displayStageBadge } from '../../utils/artistPathDisplay';

const ArtistPathProfileSlider = lazy(() => import('../../components/artistPath/ArtistPathProfileSlider'));
const ARTIST_PATH_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1UQ6zbfazKUCg6tsWCLLIclpvQlWpPj4sugwCtfXmtxA/edit';

function MetaItem({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] min-w-0">
      <Icon size={13} className="shrink-0 opacity-80" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function ResponseFallbackDetails({ answers = {}, rawRow = {} }) {
  const fallbackFields = [
    ['stageName', 'Stage name'],
    ['instagram', 'Instagram'],
    ['spotify', 'Spotify'],
    ['youtube', 'YouTube'],
    ['source', 'Source'],
  ];
  const rawFields = ['FullName', 'StageName', 'Place', 'Email', 'Mobile', 'Instagram', 'Spotify', 'Youtube'];
  const details = [
    ...fallbackFields
      .map(([key, label]) => ({ key, label, value: answers[key] }))
      .filter((item) => item.value),
    ...rawFields
      .map((key) => ({ key: `raw-${key}`, label: key, value: rawRow[key] }))
      .filter((item) => item.value && !Object.values(answers).includes(item.value)),
  ].slice(0, 8);

  if (!details.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Captured response metadata only. Open the sheet to inspect the original row.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {details.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40 px-4 py-3 min-h-[4.5rem]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            {item.label}
          </p>
          <p className="text-sm text-[var(--color-text-primary)] break-words">{String(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

function ArtistPathResponseList({ responses = [], loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-[var(--color-bg-secondary)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!responses.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">No Artist Path responses found</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Try another search or sync from sheet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map((resp) => {
        const answers = resp.answers || {};
        const hasQuestionnaireAnswers = collectGroupedAnswers(answers).length > 0;
        const name = displayRespondentName({
          name: answers.name,
          email: answers.email,
          stageName: answers.stageName,
        });
        const stageBadge = displayStageBadge({ stageName: answers.stageName });

        return (
          <Card key={resp._id} className="p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-bg-border)] pb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm text-[var(--color-text-primary)]">{name}</h3>
                  {stageBadge && <Badge variant="mint">{stageBadge}</Badge>}
                  {resp.sheetSyncStatus === 'failed' && <Badge variant="warning">Sheet sync failed</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                  <MetaItem icon={Mail}>{answers.email}</MetaItem>
                  <MetaItem icon={Phone}>{answers.phone}</MetaItem>
                  <MetaItem icon={MapPin}>{answers.city}</MetaItem>
                </div>
              </div>
              {resp.submittedAt && (
                <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  {formatDisplayDateTime(resp.submittedAt)}
                </span>
              )}
            </div>
            {hasQuestionnaireAnswers ? (
              <ArtistPathAnswerSections answers={answers} />
            ) : (
              <ResponseFallbackDetails answers={answers} rawRow={resp.rawRow || {}} />
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function ArtistPathPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [view, setView] = useState('responses');
  const [selectedId, setSelectedId] = useState(null);

  const peopleQuery = useArtistPathPeople({
    page,
    limit: 24,
    search: debouncedSearch || undefined,
  });
  const responsesQuery = useArtistPathResponses({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
  });
  const syncMutation = useArtistPathSync();

  const activeQuery = view === 'responses' ? responsesQuery : peopleQuery;
  const activeTotalPages = activeQuery.data?.pages || 0;

  const handleSync = async () => {
    try {
      const res = await syncMutation.mutateAsync();
      toast.success(`Synced ${res.data?.imported ?? 0} responses from sheet`);
      peopleQuery.refetch();
      responsesQuery.refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    }
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        icon={Music}
        title="Artist Path"
        backTo={ADMIN_CONSOLE_PATH}
        description={(
          <span className="flex flex-wrap items-center gap-2">
            <span>Live submissions appear below and are mirrored to the historical response sheet when Google credentials are configured.</span>
            <ArtistProductHint product="artistPath" />
          </span>
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(ARTIST_PATH_SHEET_URL, '_blank', 'noopener,noreferrer')}
              title="Open the historical Artist Path response sheet"
            >
              <ExternalLink size={14} /> Open Sheet
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={syncMutation.isPending}
              title="Pull latest rows from the Artist Path response sheet"
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} /> Sync from Sheet
            </Button>
          </div>
        )}
      />

      <div className="max-w-md">
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, email, phone..."
        />
      </div>

      <div className="inline-flex rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-1 w-fit">
        <button
          type="button"
          onClick={() => { setView('responses'); setPage(1); }}
          className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide ${
            view === 'responses' ? 'bg-[var(--color-action-primary)] text-white' : 'text-[var(--color-text-muted)]'
          }`}
        >
          Responses
        </button>
        <button
          type="button"
          onClick={() => { setView('people'); setPage(1); }}
          className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wide ${
            view === 'people' ? 'bg-[var(--color-action-primary)] text-white' : 'text-[var(--color-text-muted)]'
          }`}
        >
          Respondents
        </button>
      </div>

      {activeQuery.isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(activeQuery.error, 'Failed to load Artist Path data')}
          onRetry={() => activeQuery.refetch()}
        />
      )}

      {view === 'responses' ? (
        <ArtistPathResponseList
          responses={responsesQuery.data?.data || []}
          loading={responsesQuery.isLoading || responsesQuery.isFetching}
        />
      ) : (
        <ArtistPathCardGrid
          people={peopleQuery.data?.data || []}
          loading={peopleQuery.isLoading || peopleQuery.isFetching}
          onSelect={setSelectedId}
        />
      )}

      {activeTotalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Page {page} of {activeTotalPages} - {activeQuery.data?.total ?? 0} total
          </span>
          <Button variant="secondary" size="sm" disabled={page >= activeTotalPages} onClick={() => setPage((p) => p + 1)}>
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
