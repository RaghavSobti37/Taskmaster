import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui';
import MailCampaignList from '../../components/emails/MailCampaignList';
import { useMailProfiles, useScanBounces } from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { useToast } from '../../contexts/ToastContext';

export default function EmailsCampaignsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const deferProfiles = useDeferredQueryEnabled(true, { tier: 0 });
  const { data: profiles = [] } = useMailProfiles(deferProfiles);
  const scanBouncesMutation = useScanBounces();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Campaigns</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Manage drafts, dispatch, and track delivery</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            title="Scan the first SMTP profile inbox for bounce messages"
            onClick={() => {
              if (profiles.length === 0) {
                toast.warn('Configure an SMTP profile first');
                return;
              }
              scanBouncesMutation.mutate(profiles[0]?._id);
            }}
            disabled={scanBouncesMutation.isPending || profiles.length === 0}
          >
            <RefreshCw size={14} className={scanBouncesMutation.isPending ? 'animate-spin' : ''} />
            Scan Bounces
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/emails/create')}>
            <Plus size={14} /> Create Campaign
          </Button>
        </div>
      </div>
      <MailCampaignList />
    </div>
  );
}
