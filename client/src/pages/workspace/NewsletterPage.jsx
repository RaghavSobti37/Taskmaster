import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, Link2, Sparkles } from 'lucide-react';
import { ListPageLayout, DesktopRecommendedBanner, Button, Badge } from '../../components/ui';
import NewsletterLinkForm from '../../components/newsletter/NewsletterLinkForm';
import NewsletterWeekBoard from '../../components/newsletter/NewsletterWeekBoard';
import {
  useCurrentNewsletterIssue,
  useNewsletterCategories,
} from '../../hooks/queries/newsletter';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';

const NewsletterPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdminUser(user);
  const { data: categories = [] } = useNewsletterCategories();
  const { data, isLoading, refetch } = useCurrentNewsletterIssue();

  const issue = data?.issue;
  const articles = data?.articles || [];

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'week',
            label: 'Current week',
            value: issue?.weekKey || '—',
            icon: Newspaper,
            variant: 'info',
            info: 'ISO week bucket for collected links.',
          },
          {
            id: 'links',
            label: 'Links saved',
            value: isLoading ? '—' : articles.length,
            icon: Link2,
            variant: 'mint',
            info: 'Article links submitted by the team this week.',
          },
          {
            id: 'status',
            label: 'Issue status',
            value: issue?.status || '—',
            icon: Sparkles,
            variant: 'apricot',
            info: 'collecting → curating → ready → sent',
          },
        ],
      }}
    >
      <DesktopRecommendedBanner message="Newsletter curation and send are optimized for desktop." />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Weekly Newsletter</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Paste article links throughout the week. Admins compile and send when ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>Refresh</Button>
          {admin && issue?._id && (
            <>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/emails/newsletter/curate?issue=${issue._id}`)}>
                Curate
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/emails/newsletter/send/${issue._id}`)}
                disabled={issue.status !== 'ready' && !issue.compiledHtml}
              >
                Send
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/emails')}>Back to Emails</Button>
        </div>
      </div>

      {issue?.status === 'sent' && (
        <div className="mb-4">
          <Badge variant="success">This week&apos;s newsletter has been sent</Badge>
        </div>
      )}

      {issue?.status !== 'sent' && (
        <NewsletterLinkForm
          issueId={issue?._id}
          categories={categories}
          onSaved={refetch}
        />
      )}

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-bold">This week&apos;s board</h3>
        <NewsletterWeekBoard
          articles={articles}
          categories={categories}
          issueStatus={issue?.status}
          editable={issue?.status !== 'sent'}
          onChanged={refetch}
        />
      </div>
    </ListPageLayout>
  );
};

export default NewsletterPage;
