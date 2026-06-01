import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { PageContainer, Button } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';

const CreateCampaignPage = () => {
  const navigate = useNavigate();

  return (
    <PageContainer className="!py-4 !space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-[var(--color-bg-border)]">
        <Button variant="ghost" size="sm" onClick={() => navigate('/emails')}>
          <ArrowLeft size={14} /> Back to Campaigns
        </Button>
        <div className="flex items-center gap-2 text-[var(--color-action-primary)]">
          <Mail size={16} />
          <h1 className="text-sm font-black uppercase tracking-widest">New Campaign</h1>
        </div>
      </div>
      <AdminMailContent initialMode="new_campaign" hideModeBar standaloneWizard />
    </PageContainer>
  );
};

export default CreateCampaignPage;
