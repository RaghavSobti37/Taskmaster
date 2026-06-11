import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { PageContainer } from '../components/ui/primitives';
import EmptyState from '../components/ui/EmptyState';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <PageContainer className="!py-8">
      <EmptyState
        icon={MapPinOff}
        title="Page not found"
        description="This route does not exist or you may not have access."
        actionLabel="Go to dashboard"
        onAction={() => navigate('/dashboard')}
      />
    </PageContainer>
  );
}
