import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { PageContainer } from '../../components/ui/primitives';
import EmptyState from '../../components/ui/EmptyState';

export default function EmailsStreamsPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <EmptyState
        icon={Radio}
        title="Email streams"
        description="Broadcast streams and automation triggers will appear here once Resend is connected."
        actionLabel="Back to email hub"
        onAction={() => navigate('/emails')}
      />
    </PageContainer>
  );
}
