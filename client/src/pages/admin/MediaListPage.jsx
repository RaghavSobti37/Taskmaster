import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Layers, Mail, MapPin, Newspaper, Phone, Users } from 'lucide-react';
import ListPageLayout from '../../components/ui/ListPageLayout';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import { Badge, DataTable } from '../../components/ui/primitives';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';

const MediaListPage = () => {
  const [search, setSearch] = useState('');
  const [sheetFilter, setSheetFilter] = useState('');
  const [publicationFilter, setPublicationFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');

  const {
    data: contacts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['media-contacts', sheetFilter, publicationFilter, nicheFilter, search],
    queryFn: async () => {
      const params = {};
      if (sheetFilter) params.sourceSheet = sheetFilter;
      if (publicationFilter) params.publication = publicationFilter;
      if (nicheFilter) params.niche = nicheFilter;
      if (search.trim()) params.q = search.trim();
      return (await axios.get('/api/admin/media-contacts', { params })).data;
    },
  });

  const deferFilterOptions = useDeferredQueryEnabled(!isLoading);
  const { data: filterOptions } = useQuery({
    queryKey: ['media-contacts-filters', sheetFilter],
    queryFn: async () => {
      const params = sheetFilter ? { sourceSheet: sheetFilter } : {};
      return (await axios.get('/api/admin/media-contacts/filters', { params })).data;
    },
    enabled: deferFilterOptions,
  });

  const activeSheetLabel = sheetFilter || 'All sheets';
  const publicationCount = useMemo(
    () => new Set(contacts.map((c) => c.publication).filter(Boolean)).size,
    [contacts],
  );
  const sheetCount = filterOptions?.sheets?.filter((s) => s.count > 0).length || 0;

  const columns = useMemo(
    () => [
      {
        header: 'Publication / Outlet',
        sortKey: 'publication',
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]" title={row.publication}>
              {row.publication}
            </span>
            {row.location ? (
              <span className="flex items-center gap-1 truncate text-[10px] text-[var(--color-text-muted)]" title={row.location}>
                <MapPin size={10} className="shrink-0" />
                {row.location}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        header: 'Contact',
        sortKey: 'journalistName',
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate text-xs tm-data-primary" title={row.journalistName}>
              {row.journalistName}
            </span>
            {row.designation ? (
              <span className="block truncate text-[10px] text-[var(--color-text-muted)]" title={row.designation}>
                {row.designation}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        header: 'Beat / Theme',
        sortKey: 'niche',
        render: (row) => (
          row.niche ? (
            <Badge variant="info" className="max-w-full truncate" title={row.niche}>
              {row.niche}
            </Badge>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          )
        ),
      },
      {
        header: 'Email',
        sortKey: 'contactEmail',
        render: (row) => (
          row.contactEmail ? (
            <a
              href={`mailto:${row.contactEmail.split(/[;,]/)[0].trim()}`}
              className="text-[11px] text-[var(--color-accent)] hover:underline truncate block"
              title={row.contactEmail}
              onClick={(e) => e.stopPropagation()}
            >
              {row.contactEmail}
            </a>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          )
        ),
      },
      {
        header: 'Phone',
        sortKey: 'contactPhone',
        render: (row) => (
          row.contactPhone ? (
            <a
              href={`tel:${row.contactPhone}`}
              className="text-[11px] font-bold text-[var(--color-text-primary)] hover:underline truncate block"
              title={row.contactPhone}
              onClick={(e) => e.stopPropagation()}
            >
              {row.contactPhone}
            </a>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          )
        ),
      },
      {
        header: 'Sheet',
        sortKey: 'sourceSheet',
        render: (row) => (
          <Badge variant="neutral" className="max-w-[8rem] truncate" title={row.sourceSheet}>
            {row.sourceSheet}
          </Badge>
        ),
      },
    ],
    [],
  );

  if (isLoading && !contacts.length) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Media List"
      icon={Newspaper}
      backTo={ADMIN_CONSOLE_PATH}
      overview={{
        stats: [
          {
            id: 'total',
            label: 'Contacts',
            value: contacts.length,
            icon: Users,
            variant: 'info',
            info: `Showing ${activeSheetLabel}.`,
          },
          {
            id: 'sheets',
            label: 'Sheets loaded',
            value: sheetCount,
            icon: Layers,
            variant: 'mint',
            info: 'Imported spreadsheet tabs in production.',
          },
          {
            id: 'publications',
            label: 'Outlets',
            value: publicationCount,
            icon: Building2,
            variant: 'amber',
          },
          {
            id: 'withEmail',
            label: 'With Email',
            value: contacts.filter((c) => c.contactEmail).length,
            icon: Mail,
            variant: 'rose',
          },
          {
            id: 'withPhone',
            label: 'With Phone',
            value: contacts.filter((c) => c.contactPhone).length,
            icon: Phone,
            variant: 'info',
          },
        ],
      }}
      toolbar={
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <select
            value={sheetFilter}
            onChange={(e) => {
              setSheetFilter(e.target.value);
              setPublicationFilter('');
              setNicheFilter('');
            }}
            className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text-primary)] max-w-[14rem] truncate font-semibold"
            aria-label="Filter by spreadsheet tab"
          >
            <option value="">All sheets ({filterOptions?.sheets?.reduce((n, s) => n + s.count, 0) || 0})</option>
            {(filterOptions?.sheets || []).map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} ({sheet.count})
              </option>
            ))}
          </select>
          <SearchInput
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-44 shrink min-w-[9rem]"
          />
          <select
            value={publicationFilter}
            onChange={(e) => setPublicationFilter(e.target.value)}
            className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text-primary)] max-w-[12rem] truncate"
            aria-label="Filter by publication"
          >
            <option value="">All outlets</option>
            {(filterOptions?.publications || []).map((pub) => (
              <option key={pub} value={pub}>{pub}</option>
            ))}
          </select>
          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text-primary)] max-w-[12rem] truncate"
            aria-label="Filter by beat"
          >
            <option value="">All beats</option>
            {(filterOptions?.niches || []).map((niche) => (
              <option key={niche} value={niche}>{niche}</option>
            ))}
          </select>
        </div>
      }
      toolbarActions={
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          <Newspaper size={14} />
          TSC Media Directory
        </div>
      }
    >
      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load media directory')}
          onRetry={() => refetch()}
        />
      )}
      <DataTable
        columns={columns}
        data={contacts}
        getRowId={(row) => row._id}
        fitWidth
        emptyTitle="No contacts found"
        emptyDescription="Try another sheet tab or clear filters."
      />
    </ListPageLayout>
  );
};

export default MediaListPage;
