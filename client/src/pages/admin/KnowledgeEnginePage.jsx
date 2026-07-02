import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Brain, Play } from 'lucide-react';
import { PageContainer, Button, Badge, DataTable, Input, TabSwitcher } from '../../components/ui/primitives';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import AdminConsoleBackButton from '../../components/admin/AdminConsoleBackButton';
import { formatDisplayDate } from '../../utils/dateDisplay';
import { useToast } from '../../contexts/ToastContext';
import {
  useKnowledgeDashboard,
  useKnowledgeArticles,
  useKnowledgeChunks,
  useKnowledgeCalendar,
  useKnowledgeKeywords,
  useKnowledgeOpportunities,
  useKnowledgeBriefs,
  useKnowledgeConnections,
  useKnowledgeSources,
  useKnowledgeDistribution,
  useKnowledgeOutreach,
  useKnowledgeAnalytics,
  useKnowledgeSettings,
  useKnowledgeJobTrigger,
  useApproveKnowledgeArticle,
  usePublishKnowledgeArticle,
  useGenerateBrief,
  useRunArticlePipeline,
  useMediumPrep,
  useSetMediumUrl,
  useUpdateKnowledgeSettings,
  useCreateKnowledgeArticle,
  useCreateDistribution,
} from '../../hooks/queries/knowledgeEngine';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'articles', label: 'Articles' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'briefs', label: 'Briefs' },
  { id: 'connections', label: 'Connections' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
];

function JobButtons({ jobs }) {
  const trigger = useKnowledgeJobTrigger();
  const toast = useToast();
  const run = async (job) => {
    try {
      await trigger.mutateAsync(job);
      toast.success(`Job queued: ${job}`);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {jobs.map((job) => (
        <Button key={job} size="sm" variant="secondary" onClick={() => run(job)} disabled={trigger.isPending}>
          <Play size={14} className="mr-1" /> {job}
        </Button>
      ))}
    </div>
  );
}

function DashboardTab() {
  const { data, isLoading, error } = useKnowledgeDashboard();
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  if (isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>;
  const { stats, settings } = data || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Knowledge chunks', stats?.knowledgeChunks],
          ['Published', stats?.published],
          ['Pending review', stats?.pendingReview],
          ['Score ≥80', stats?.highScoreOpportunities],
        ].map(([label, val]) => (
          <div key={label} className="p-4 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className="text-2xl font-bold">{val ?? 0}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-bold mb-2">Pipeline jobs</h3>
        <JobButtons jobs={['knowledge-ingest', 'opportunity-extract', 'keyword-discover', 'opportunity-score', 'rank-track', 'self-improve-weekly']} />
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Publish threshold: {settings?.minPublishScore ?? 80} · Approval required: {settings?.requireHumanApproval ? 'Yes' : 'No'}
      </p>
      {(stats?.recentPipelineRuns || []).slice(0, 5).map((run) => (
        <div key={run._id} className="text-xs flex gap-2">
          <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'default'}>{run.status}</Badge>
          <span>{run.jobType}</span>
          <span className="text-[var(--color-text-muted)]">{formatDisplayDate(run.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function ArticlesTab() {
  const { data, error } = useKnowledgeArticles({ limit: 50 });
  const approve = useApproveKnowledgeArticle();
  const publish = usePublishKnowledgeArticle();
  const mediumPrep = useMediumPrep();
  const setMedium = useSetMediumUrl();
  const createArticle = useCreateKnowledgeArticle();
  const [mediumInput, setMediumInput] = useState({});

  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;

  const columns = [
    { key: 'title', label: 'Title', render: (row) => <span className="font-medium">{row.title}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'qualityScore', label: 'Score', render: (row) => row.qualityScore ?? '—' },
    { key: 'publishedAt', label: 'Published', render: (row) => (row.publishedAt ? formatDisplayDate(row.publishedAt) : '—') },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.status === 'draft' && <Button size="xs" onClick={() => approve.mutate(row._id)}>Review</Button>}
          {(row.status === 'review' || row.status === 'scheduled') && (
            <Button size="xs" onClick={() => publish.mutate(row._id)}>Publish</Button>
          )}
          {row.status === 'published' && !row.mediumUrl && (
            <Button size="xs" variant="secondary" onClick={() => mediumPrep.mutate(row._id)}>Medium prep</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        onClick={() => createArticle.mutate({
          title: 'New draft article',
          bodyMarkdown: '## Draft\n\nEdit in CoreKnot.',
          excerpt: 'Draft excerpt',
        })}
      >
        New draft
      </Button>
      <DataTable columns={columns} data={data?.items || []} emptyMessage="No articles yet" />
      {(data?.items || []).filter((a) => a.status === 'published' && !a.mediumUrl).map((a) => (
        <div key={a._id} className="flex gap-2 items-center text-xs border-t pt-2">
          <span className="flex-1 truncate">{a.title}</span>
          <Input
            placeholder="Paste Medium URL"
            value={mediumInput[a._id] || ''}
            onChange={(e) => setMediumInput((s) => ({ ...s, [a._id]: e.target.value }))}
            className="max-w-xs"
          />
          <Button size="xs" onClick={() => setMedium.mutate({ id: a._id, mediumUrl: mediumInput[a._id] })}>Save</Button>
        </div>
      ))}
    </div>
  );
}

function KnowledgeTab() {
  const [q, setQ] = useState('');
  const { data, error } = useKnowledgeChunks({ q: q || undefined, limit: 30 });
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  return (
    <div className="space-y-4">
      <JobButtons jobs={['knowledge-ingest']} />
      <SearchInput value={q} onChange={setQ} placeholder="Search knowledge base…" />
      <div className="space-y-2">
        {(data?.items || []).map((chunk) => (
          <div key={chunk._id} className="p-3 border rounded-lg text-sm">
            <div className="flex gap-2 mb-1">
              <Badge>{chunk.sourceType}</Badge>
              <span className="font-medium">{chunk.title}</span>
            </div>
            <p className="text-[var(--color-text-secondary)] line-clamp-2">{chunk.excerpt || chunk.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunitiesTab() {
  const { data, error } = useKnowledgeOpportunities({ minScore: 0 });
  const generateBrief = useGenerateBrief();
  const runPipeline = useRunArticlePipeline();
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  return (
    <div className="space-y-3">
      {(data?.items || []).map((opp) => (
        <div key={opp._id} className="p-3 border rounded-lg flex flex-wrap gap-2 items-center justify-between">
          <div>
            <p className="font-medium">{opp.title}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Score: {opp.overallScore} · {opp.status}</p>
          </div>
          <div className="flex gap-2">
            <Button size="xs" variant="secondary" onClick={() => generateBrief.mutate(opp._id)}>Brief</Button>
            <Button size="xs" onClick={() => runPipeline.mutate({ opportunityId: opp._id })}>Generate article</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BriefsTab() {
  const { data, error } = useKnowledgeBriefs();
  const runPipeline = useRunArticlePipeline();
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  return (
    <div className="space-y-3">
      {(data?.items || []).map((b) => (
        <div key={b._id} className="p-3 border rounded-lg">
          <p className="font-medium">{b.title}</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">/{b.slug} · {b.status}</p>
          <Button size="xs" onClick={() => runPipeline.mutate({ briefId: b._id })}>Run article pipeline</Button>
        </div>
      ))}
    </div>
  );
}

function ConnectionsTab() {
  const { data: connections, error: cErr } = useKnowledgeConnections();
  const { data: sources, error: sErr } = useKnowledgeSources();
  if (cErr || sErr) return <QueryErrorBanner message={getQueryErrorMessage(cErr || sErr)} />;
  const providers = ['gsc', 'ga4', 'google_trends', 'meta', 'linkedin', 'medium', 'website'];
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">Connect GSC, GA4, and social accounts for ingestion.</p>
      <div className="grid gap-2">
        {providers.map((p) => {
          const conn = (connections || []).find((c) => c.provider === p);
          const src = (sources || []).find((s) => s.type === p || (p === 'website' && s.type === 'website'));
          return (
            <div key={p} className="flex justify-between items-center p-3 border rounded-lg text-sm">
              <span className="font-medium uppercase">{p}</span>
              <Badge variant={conn?.status === 'connected' || src?.status === 'ok' ? 'success' : 'default'}>
                {conn?.status || src?.status || 'not connected'}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistributionTab() {
  const { data: articles } = useKnowledgeArticles({ status: 'published', limit: 10 });
  const [selected, setSelected] = useState('');
  const articleId = selected || articles?.items?.[0]?._id;
  const { data, error } = useKnowledgeDistribution(articleId || undefined);
  const createDist = useCreateDistribution();
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  return (
    <div className="space-y-4">
      <select className="border rounded px-2 py-1 text-sm" value={articleId || ''} onChange={(e) => setSelected(e.target.value)}>
        {(articles?.items || []).map((a) => <option key={a._id} value={a._id}>{a.title}</option>)}
      </select>
      {articleId && <Button size="sm" onClick={() => createDist.mutate(articleId)}>Generate social variants</Button>}
      {(data || []).map((job) => (
        <div key={job._id} className="p-3 border rounded-lg text-sm">
          <div className="flex gap-2 mb-1"><Badge>{job.platform}</Badge><Badge>{job.status}</Badge></div>
          <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-secondary)]">{job.content}</pre>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const { data: settings, error } = useKnowledgeSettings();
  const update = useUpdateKnowledgeSettings();
  const [form, setForm] = useState(null);
  React.useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  if (!form) return null;
  return (
    <div className="space-y-4 max-w-lg">
      <label className="block text-sm">
        Brand voice
        <textarea className="w-full border rounded p-2 mt-1 text-sm" rows={3} value={form.brandVoice || ''} onChange={(e) => setForm({ ...form, brandVoice: e.target.value })} />
      </label>
      <label className="block text-sm">
        Min publish score
        <Input type="number" value={form.minPublishScore} onChange={(e) => setForm({ ...form, minPublishScore: Number(e.target.value) })} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!form.requireHumanApproval} onChange={(e) => setForm({ ...form, requireHumanApproval: e.target.checked })} />
        Require human approval before publish
      </label>
      <Button onClick={() => update.mutate(form)}>Save settings</Button>
    </div>
  );
}

function AnalyticsPanel() {
  const { data, error } = useKnowledgeAnalytics();
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="p-4 border rounded-lg"><p className="text-xs text-muted">Clicks (30d)</p><p className="text-xl font-bold">{data?.totalClicks ?? 0}</p></div>
      <div className="p-4 border rounded-lg"><p className="text-xs text-muted">Impressions</p><p className="text-xl font-bold">{data?.totalImpressions ?? 0}</p></div>
      <div className="p-4 border rounded-lg"><p className="text-xs text-muted">Avg CTR %</p><p className="text-xl font-bold">{(data?.avgCtr ?? 0).toFixed(2)}</p></div>
    </div>
  );
}

function SimpleListTab({ useHook, renderItem }) {
  const { data, error } = useHook();
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;
  const items = data?.items || data || [];
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

export default function KnowledgeEnginePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';
  const tabOptions = useMemo(() => TABS.map((t) => ({ id: t.id, label: t.label })), []);
  const setTab = (id) => setSearchParams({ tab: id });

  const panel = useMemo(() => {
    switch (tab) {
      case 'dashboard': return <DashboardTab />;
      case 'articles': return <ArticlesTab />;
      case 'knowledge': return <KnowledgeTab />;
      case 'calendar':
        return (
          <SimpleListTab
            useHook={useKnowledgeCalendar}
            renderItem={(e) => (
              <div key={e._id} className="p-3 border rounded text-sm flex justify-between">
                <span>{e.title || e.slotType}</span>
                <span>{formatDisplayDate(e.scheduledDate)} · {e.status}</span>
              </div>
            )}
          />
        );
      case 'keywords':
        return (
          <SimpleListTab
            useHook={useKnowledgeKeywords}
            renderItem={(k) => (
              <div key={k._id} className="p-3 border rounded text-sm">
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{k.keywords?.length || 0} keywords · {k.pillarKeyword}</p>
              </div>
            )}
          />
        );
      case 'opportunities': return <OpportunitiesTab />;
      case 'briefs': return <BriefsTab />;
      case 'connections': return <ConnectionsTab />;
      case 'distribution': return <DistributionTab />;
      case 'outreach':
        return (
          <SimpleListTab
            useHook={useKnowledgeOutreach}
            renderItem={(c) => (
              <div key={c._id} className="p-3 border rounded text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs">{c.tier} · {c.prospects?.length || 0} prospects</p>
              </div>
            )}
          />
        );
      case 'analytics': return <AnalyticsPanel />;
      case 'settings': return <SettingsTab />;
      default: return <DashboardTab />;
    }
  }, [tab]);

  return (
    <PageContainer>
      <AdminConsoleBackButton />
      <PageHeader icon={Brain} title="Knowledge Engine" subtitle="SEO content pipeline for The Shakti Collective" className="mt-4" />
      <div className="mt-6">
        <TabSwitcher tabs={tabOptions} activeTab={tab} onChange={setTab} />
      </div>
      <div className="mt-6">{panel}</div>
    </PageContainer>
  );
}
