import React, { useState } from 'react';
import { PageContainer } from '../../components/ui';
import ExlyDataContent from '../../components/admin/ExlyDataContent';
import MasterclassFunnelPanel from '../../components/admin/MasterclassFunnelPanel';
import { GraduationCap, Layers } from 'lucide-react';

const ExlyCampaignsPage = () => {
  const [view, setView] = useState('funnel');
  const [openOfferingId, setOpenOfferingId] = useState(null);

  const handleOpenSession = (offeringId) => {
    setOpenOfferingId(offeringId);
    setView('records');
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[var(--color-bg-border)] pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
            Admin · Exly
          </p>
          <h1 className="text-lg font-black text-[var(--color-text-primary)] mt-0.5">
            Masterclass → Course
          </h1>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
          <button
            type="button"
            onClick={() => setView('funnel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
              view === 'funnel'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <GraduationCap size={12} />
            Funnel
          </button>
          <button
            type="button"
            onClick={() => setView('records')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
              view === 'records'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Layers size={12} />
            All Exly records
          </button>
        </div>
      </div>

      {view === 'funnel' ? (
        <MasterclassFunnelPanel onOpenSession={handleOpenSession} />
      ) : (
        <ExlyDataContent
          mode="campaigns"
          initialOfferingId={openOfferingId}
          onInitialOfferingOpened={() => setOpenOfferingId(null)}
        />
      )}
    </PageContainer>
  );
};

export default ExlyCampaignsPage;
