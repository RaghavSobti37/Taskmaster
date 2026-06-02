import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { PageContainer, PageHeader, Button } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';

const CreateCampaignPage = () => {
  const navigate = useNavigate();

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        title="New Campaign"
        icon={Mail}
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/emails')}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />
      <AdminMailContent initialMode="new_campaign" hideModeBar standaloneWizard />
    </PageContainer>
  );
};

export default CreateCampaignPage;
