import React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ListPageLayout, Button } from '../../components/ui';
import NewsletterCuratorPanel from '../../components/newsletter/NewsletterCuratorPanel';
import {
  useCurrentNewsletterIssue,
  useNewsletterCategories,
  useNewsletterIssue,
} from '../../hooks/queries/newsletter';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';

const NewsletterCuratePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const issueParam = params.get('issue');
  const { user, loading } = useAuth();
  const { data: categories = [] } = useNewsletterCategories();
  const currentQuery = useCurrentNewsletterIssue();
  const issueQuery = useNewsletterIssue(issueParam, !!issueParam);

  if (!loading && !isAdminUser(user)) {
    return <Navigate to="/emails/newsletter" replace />;
  }

  const activeQuery = issueParam ? issueQuery : currentQuery;
  const issue = activeQuery.data?.issue;
  const articles = activeQuery.data?.articles || [];

  if (activeQuery.isLoading) {
    return (
      <ListPageLayout containerClassName="!py-4">
        <p className="text-sm text-[var(--color-text-muted)]">Loading issue…</p>
      </ListPageLayout>
    );
  }

  if (!issue) {
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
          <h2 className="text-lg font-bold tracking-tight">Curate newsletter</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Reorder, edit, exclude links, then compile.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/emails/newsletter')}>Back to board</Button>
      </div>
      <NewsletterCuratorPanel issue={issue} articles={articles} categories={categories} />
    </ListPageLayout>
  );
};

export default NewsletterCuratePage;
