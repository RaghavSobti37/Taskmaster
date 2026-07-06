import React from 'react';
import { Radio } from 'lucide-react';
import { PageContainer, DataTable, PageLoadGuard, PageSkeleton } from '../../components/ui';
import { useEmailStreams } from '../../hooks/queries/mail';

export default function EmailsStreamsPage() {
  const { data: streams = [], isLoading } = useEmailStreams();

  return (
    <PageContainer>
      <PageLoadGuard loading={isLoading} skeleton={PageSkeleton}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Radio size={20} className="text-[var(--color-action-primary)]" aria-hidden="true" />
            <h1 className="tm-page-title">Email streams</h1>
          </div>
          <DataTable
            columns={[
              { header: 'Stream', render: (row) => row.name || row.slug },
              { header: 'Slug', render: (row) => row.slug },
              { header: 'From addresses', render: (row) => (row.fromEmails || []).join(', ') || '-' },
              { header: 'Status', render: (row) => (row.isActive === false ? 'Inactive' : 'Active') },
            ]}
            data={streams}
            paginated={false}
            getRowId={(row) => row.slug}
          />
        </div>
      </PageLoadGuard>
    </PageContainer>
  );
}
