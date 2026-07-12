import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ListPageLayout, Button, LoadingText, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import NewsletterSendWizard from '../../components/newsletter/NewsletterSendWizard';
import { useNewsletterIssue } from '../../hooks/queries/newsletter';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';

const NewsletterSendPage = () => {
  const navigate = useNavigate();
  const { issueId } = useParams();
  const { user, loading } = useAuth();
  const { data, isLoading, isError, error, refetch } = useNewsletterIssue(issueId, !!issueId);

  if (!loading && !isAdminUser(user)) {
    return <Navigate to="/emails/newsletter" replace />;
  }

  if (isLoading) {
    return (
      <ListPageLayout containerClassName="!py-4">
        <LoadingText className="text-sm text-[var(--color-text-muted)]">Loading issue…</LoadingText>
      </ListPageLayout>
    );
  }

  if (isError) {
    return (
      <ListPageLayout containerClassName="!py-4">
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load newsletter issue')}
          onRetry={() => refetch()}
        />
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/emails/newsletter')}>Back</Button>
      </ListPageLayout>
    );
  }

  if (!data?.issue) {
    return (
      <ListPageLayout containerClassName="!py-4">
        <p className="text-sm text-[var(--color-text-muted)]">Newsletter issue not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/emails/newsletter')}>Back</Button>
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout containerClassName="!py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Send newsletter</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Choose audiences from newsletter list, Artist Path, Exly, and Data Hub folders.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/emails/newsletter')}>Back to board</Button>
      </div>
      <NewsletterSendWizard issue={data.issue} />
    </ListPageLayout>
  );
};

export default NewsletterSendPage;
