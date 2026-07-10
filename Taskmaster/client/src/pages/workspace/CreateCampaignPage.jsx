import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { PageContainer, PageHeader, Button, DesktopRecommendedBanner } from '../../components/ui';
import CampaignWizardShell from '../../components/emails/wizard/CampaignWizardShell';

const CreateCampaignPage = () => {
  const navigate = useNavigate();

  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        title="New Campaign"
        icon={Mail}
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/emails/campaigns')}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />
      <DesktopRecommendedBanner message="Campaign wizard is optimized for desktop." />
      <CampaignWizardShell />
    </PageContainer>
  );
};

export default CreateCampaignPage;
