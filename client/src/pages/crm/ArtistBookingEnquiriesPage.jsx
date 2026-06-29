import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo, useState } from 'react';
import { PageContainer, Badge, DataTable, ListPageLayout, SearchInput, PageSkeleton, Button, DEFAULT_TABLE_PAGE_SIZE, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { Modal } from '../../components/ui/modals';
import { useLiveLeads } from '../../hooks/useTaskmasterQueries';
import { crmQueryParamsForUser } from '../../utils/crmScope';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import ArtistBookingEnquiryPanel from '../../components/crm/ArtistBookingEnquiryPanel';

export default function ArtistBookingEnquiriesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  const params = useMemo(() => crmQueryParamsForUser(user, {
    page,
    limit: pageSize,
    search: debouncedSearch,
    contactCategory: 'booking_enquiry',
    sort: 'createdAt',
    order: 'desc',
  }), [user, page, pageSize, debouncedSearch]);

  const { data, isLoading, isError, error, refetch } = useLiveLeads(params);
  const leads = data?.leads || [];

  const columns = [
    {
      header: 'Enquiry',
      mobilePrimary: true,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-bold text-xs">{row.name}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {[row.metadata?.company, row.artistProject].filter(Boolean).join(' • ')}
          </span>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {row.email} {row.phone ? `• ${row.phone}` : ''}
          </span>
        </div>
      ),
    },
    {
      header: 'Artist',
      render: (row) => (
        <Badge variant="info">{row.artistProject || row.metadata?.artist || '—'}</Badge>
      ),
    },
    {
      header: 'When / Where',
      render: (row) => (
        <span className="text-[10px] text-[var(--color-text-muted)] max-w-[200px] truncate block">
          {row.metadata?.whenWhere || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.callStatus === 'Scheduled' ? 'warning' : 'slate'}>
          {(row.callStatus || row.leadStatus || 'New').toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Received',
      render: (row) => (
        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
          {row.createdAt ? formatDisplayDate(new Date(row.createdAt)) : '—'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer className="!py-4 !space-y-4">
      <ListPageLayout
        title="Booking Enquiries"
        subtitle="Website /query submissions routed to artist management"
        actions={(
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search enquiries…"
            className="w-64"
          />
        )}
      >
        {isError && (
          <QueryErrorBanner
            className="mb-4"
            message={getQueryErrorMessage(error, 'Failed to load booking enquiries')}
            onRetry={() => refetch()}
          />
        )}
        {isLoading ? (
          <PageSkeleton rows={6} />
        ) : (
          <DataTable
            columns={columns}
            data={leads}
            onRowClick={(row) => setSelected(row)}
            getRowId={(row) => row._id}
            serverSide
            paginated
            totalItems={data?.total || 0}
            totalPages={data?.pages || 1}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            emptyTitle="No booking enquiries yet"
          />
        )}
      </ListPageLayout>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || 'Enquiry'} size="lg">
        {selected && (
          <div className="space-y-4">
            <ArtistBookingEnquiryPanel lead={selected} />
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
