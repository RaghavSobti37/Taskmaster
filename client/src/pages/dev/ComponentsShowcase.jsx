import React, { useMemo, useState } from 'react';
import {
  Plus, Search, Trash2, Settings, Database, TrendingUp, Inbox, Bell, Edit2,
  Mail, Users, Briefcase, StickyNote,
} from 'lucide-react';
import AppErrorPage from '../../components/AppErrorPage';
import { emitSystemEvent } from '../../lib/systemLogBridge';
import { SEVERITY, MODULE } from '../../lib/systemLogContract';
import {
  PageContainer,
  PageHeader,
  PageToolbar,
  Button,
  Card,
  Input,
  FormFieldGrid,
  Badge,
  StatusBadge,
  StatCard,
  TabSwitcher,
  Switch,
  ProgressBar,
  Accordion,
  DataTable,
  ListPageLayout,
  HubPageLayout,
  ModuleSubnav,
  Skeleton,
  NexusDropdown,
  EmptyState,
  AddMembers,
  SearchInput,
  PasswordInput,
  IconButton,
  SectionCard,
  Spinner,
  LoadingState,
  DataLoading,
  BrandedLoadingPanel,
  PageSkeleton,
  ListPageSkeleton,
  DashboardWidgetShell,
  DataListRow,
  DeltaBadge,
  ValueChange,
  DataInsightsLayout,
  MetricPanelGroup,
  MetricBlock,
  MetricCard,
  ListCard,
  CountBadge,
  Banner,
  QueryErrorBanner,
  TimeframeFilter,
  MobileCollapsibleSection,
  DesktopRecommendedBanner,
  UserAvatar,
  UserLabel,
  countActiveFilters,
} from '../../components/ui';
import { NexusModal, ModalShell, ModalHeader, ModalBody, ModalFooter } from '../../components/ui/modals';
import { ChartSurface } from '../../components/ui/charts';
import FluidRibbonLoaderGallery from '../../components/brand/FluidRibbonLoaderGallery';

const SHOWCASE_MOCK_USERS = [
  { _id: 'u1', name: 'Alex Rivera', email: 'alex@coreknot.com', role: 'admin' },
  { _id: 'u2', name: 'Sam Chen', email: 'sam@coreknot.com', role: 'ops' },
  { _id: 'u3', name: 'Jordan Lee', email: 'jordan@coreknot.com', role: 'sales' },
  { _id: 'u4', name: 'Taylor Kim', email: 'taylor@coreknot.com', role: 'member' },
];

const SHOWCASE_DROPDOWN_OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

const SHOWCASE_TABLE_DATA = [
  { id: 1, name: 'Alpha Project', status: 'in-progress', owner: 'Alex' },
  { id: 2, name: 'Beta Launch', status: 'complete', owner: 'Sam' },
  { id: 3, name: 'Gamma Audit', status: 'overdue', owner: 'Jordan' },
  { id: 4, name: 'Delta Rollout', status: 'in-progress', owner: 'Taylor' },
  { id: 5, name: 'Epsilon QA', status: 'complete', owner: 'Alex' },
];

const NAV_SECTIONS = [
  ['buttons', 'Buttons'],
  ['inputs', 'Inputs'],
  ['badges', 'Badges'],
  ['navigation', 'Navigation'],
  ['dropdowns', 'Dropdowns'],
  ['cards-data', 'Cards & data'],
  ['tables', 'Tables'],
  ['charts', 'Charts'],
  ['layout', 'Layout'],
  ['modals', 'Modals'],
  ['forms', 'Forms'],
  ['feedback', 'Feedback'],
  ['error-page', 'Error page'],
  ['notifications', 'Toasts'],
  ['loading', 'Loading'],
  ['avatars', 'Avatars'],
  ['brand-loaders', 'Brand loaders'],
];

const ERROR_SHOWCASE_VARIANTS = {
  server503: {
    label: '503 — Server unavailable',
    statusCode: 503,
    showHealthyBadge: true,
    summary: 'This page could not load because the server did not respond. This usually resolves in under a minute.',
    error: new Error('HTTP 503 Service Unavailable'),
    errorRef: 'CK-20260703-A1B2',
    capturedAt: Date.parse('2026-07-03T14:12:00.000Z'),
  },
  routeChunk: {
    label: 'Route — chunk load failed',
    summary: 'A part of the app failed to load. Refresh usually fixes this.',
    error: new Error('Loading chunk 42 failed'),
    errorRef: 'CK-20260703-C4D5',
    capturedAt: Date.parse('2026-07-03T14:12:00.000Z'),
  },
  bootTimeout: {
    label: 'Boot — connection timed out',
    summary: 'Connection timed out. Check your network and try again.',
    error: new Error('Connection timed out'),
    errorRef: 'CK-20260703-E6F7',
    capturedAt: Date.parse('2026-07-03T14:12:00.000Z'),
  },
  permission: {
    label: '403 — Access denied',
    statusCode: 403,
    summary: 'You may not have permission to view this content.',
    error: new Error('HTTP 403 Forbidden'),
    errorRef: 'CK-20260703-F8G9',
    capturedAt: Date.parse('2026-07-03T14:12:00.000Z'),
  },
};

const embeddedErrorClass =
  '!min-h-0 min-h-[36rem] rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] overflow-hidden';

const ShowcaseSection = ({ id, title, description, children }) => (
  <section id={id} className="scroll-mt-24 space-y-4">
    <div>
      <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-3xl">{description}</p>
      )}
    </div>
    <Card className="p-4 sm:p-6 space-y-4">{children}</Card>
  </section>
);

const VariantRow = ({ label, children }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const ComponentsShowcase = () => {
  const [activeTab, setActiveTab] = useState('library');
  const [switchOn, setSwitchOn] = useState(true);
  const [dropdownVal, setDropdownVal] = useState('a');
  const [search, setSearch] = useState('');
  const [password, setPassword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [showSkeletonPreview, setShowSkeletonPreview] = useState(false);
  const [demoLeadCount, setDemoLeadCount] = useState(1284);
  const [hubTab, setHubTab] = useState('leads');
  const [timeframe, setTimeframe] = useState('7d');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [errorVariant, setErrorVariant] = useState('server503');
  const [errorFullscreen, setErrorFullscreen] = useState(false);

  const activeErrorDemo = useMemo(
    () => ERROR_SHOWCASE_VARIANTS[errorVariant] || ERROR_SHOWCASE_VARIANTS.server503,
    [errorVariant],
  );

  const tableColumns = [
    { header: 'Name', key: 'name', sortKey: 'name' },
    { header: 'Owner', key: 'owner', sortKey: 'owner' },
    {
      header: 'Status',
      key: 'status',
      sortKey: 'status',
      render: (row) => <StatusBadge status={row?.status}>{row?.status}</StatusBadge>,
    },
  ];

  const showcaseFilterFields = useMemo(() => [
    {
      id: 'visibility',
      label: 'Visibility',
      type: 'radio',
      value: visibilityFilter,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All' },
        { value: 'team', label: 'Team' },
        { value: 'private', label: 'Private' },
      ],
      onChange: setVisibilityFilter,
    },
  ], [visibilityFilter]);

  const chartPreviewData = [
    { date: 'Mon', value: 18 },
    { date: 'Tue', value: 24 },
    { date: 'Wed', value: 21 },
    { date: 'Thu', value: 31 },
    { date: 'Fri', value: 27 },
  ];

  return (
    <PageContainer maxWidth="1200px">
      <PageHeader
        icon={Settings}
        title="Component Library"
        description="Live catalog of production UI — only components shipped in the app."
        actions={(
          <Button size="sm" variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
          </Button>
        )}
      />

      <Card className="p-3 sticky top-2 z-10 bg-[var(--color-bg-surface)]/95">
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          {NAV_SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="px-2 py-1 rounded-md border border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)] hover:text-[var(--color-action-primary)] transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </Card>

      <TabSwitcher
        tabs={[
          { id: 'library', label: 'Library' },
          { id: 'tokens', label: 'Tokens' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'tokens' && (
        <Card className="p-6 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            App shell uses slate neutrals; TSC cream/teal on <code className="text-[10px]">.tm-marketing-page</code> only.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['--color-bg-primary', 'Primary BG'],
              ['--color-bg-secondary', 'Secondary BG'],
              ['--color-bg-surface', 'Surface'],
              ['--color-action-primary', 'Action'],
              ['--color-pastel-mint-bg', 'Mint'],
              ['--color-pastel-apricot-bg', 'Apricot'],
              ['--color-pastel-rose-bg', 'Rose'],
              ['--color-pastel-slate-bg', 'Slate'],
            ].map(([token, label]) => (
              <div key={token} className="space-y-1">
                <div className="h-10 rounded-md border border-[var(--color-bg-border)]" style={{ background: `var(${token})` }} />
                <p className="text-[9px] font-mono text-[var(--color-text-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'library' && (
        <div className="space-y-8">
          <ShowcaseSection id="buttons" title="Buttons" description="Button + IconButton from primitives.">
            <VariantRow label="Variants">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="mint">Mint</Button>
            </VariantRow>
            <VariantRow label="Sizes">
              <Button size="xs">XS</Button>
              <Button size="sm">SM</Button>
              <Button size="md">MD</Button>
              <Button size="lg">LG</Button>
            </VariantRow>
            <VariantRow label="With icon">
              <Button size="sm"><Plus size={14} /> Add item</Button>
              <Button size="sm" variant="danger"><Trash2 size={14} /> Delete</Button>
              <Button size="sm" variant="secondary" disabled>Disabled</Button>
            </VariantRow>
            <VariantRow label="IconButton">
              <IconButton icon={Edit2} label="Edit" />
              <IconButton icon={Trash2} label="Delete" variant="danger" />
              <IconButton icon={Bell} label="Notify" variant="primary" size="lg" />
            </VariantRow>
          </ShowcaseSection>

          <ShowcaseSection id="inputs" title="Inputs" description="Input, SearchInput, PasswordInput, Switch.">
            <FormFieldGrid>
              <Input label="Text field" placeholder="Enter value..." />
              <Input label="With icon" icon={Database} placeholder="Search database..." />
              <SearchInput
                label="SearchInput"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search with clear..."
              />
              <PasswordInput
                label="PasswordInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <Input label="Multiline" multiline rows={3} placeholder="Notes..." />
              <Input variant="ghost" label="Ghost (inline edit)" defaultValue="Editable value" />
            </FormFieldGrid>
            <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-bg-border)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">Switch</p>
              <Switch checked={switchOn} onChange={setSwitchOn} />
              <span className="text-xs text-[var(--color-text-muted)]">{switchOn ? 'On' : 'Off'}</span>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="badges" title="Badges" description="Badge (semantic), StatusBadge (role-based), CountBadge, DeltaBadge, ValueChange.">
            <VariantRow label="Badge">
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="in-progress">In Progress</Badge>
              <Badge variant="overdue">Overdue</Badge>
            </VariantRow>
            <VariantRow label="StatusBadge">
              <StatusBadge status="complete">Complete</StatusBadge>
              <StatusBadge status="in-progress">In progress</StatusBadge>
              <StatusBadge status="overdue">Overdue</StatusBadge>
              <StatusBadge status="draft">Draft</StatusBadge>
            </VariantRow>
            <VariantRow label="CountBadge + DeltaBadge + ValueChange">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-bg-border)]">
                <Bell size={14} />
                Inbox
                <CountBadge count={3} variant="teal" />
              </span>
              <CountBadge count={12} variant="warning" pulse />
              <DeltaBadge value="+12%" direction="up" />
              <DeltaBadge value="-8%" direction="down" />
              <ValueChange oldValue="35" newValue="42" />
            </VariantRow>
          </ShowcaseSection>

          <ShowcaseSection id="navigation" title="Navigation" description="TabSwitcher (page-level) + ModuleSubnav (hub tabs).">
            <TabSwitcher
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'activity', label: 'Activity' },
                { id: 'settings', label: 'Settings' },
              ]}
              activeTab="overview"
              onChange={() => {}}
            />
            <ModuleSubnav
              title="CRM"
              titleIcon={Users}
              mode="tabs"
              activeId={hubTab}
              onTabChange={setHubTab}
              tabsFitContent
              items={[
                { id: 'leads', label: 'Leads', icon: Users, badge: 4 },
                { id: 'pipeline', label: 'Pipeline', icon: Briefcase },
                { id: 'mail', label: 'Mail', icon: Mail, badge: 2, badgeVariant: 'warning' },
              ]}
              action={{ label: 'Import', icon: Plus, onClick: () => {} }}
            />
          </ShowcaseSection>

          <ShowcaseSection id="dropdowns" title="Dropdowns" description="NexusDropdown — searchable select used in forms and toolbars.">
            <FormFieldGrid>
              <NexusDropdown
                label="NexusDropdown"
                options={SHOWCASE_DROPDOWN_OPTIONS}
                value={dropdownVal}
                onChange={setDropdownVal}
                searchable
              />
            </FormFieldGrid>
          </ShowcaseSection>

          <ShowcaseSection id="cards-data" title="Cards & data display" description="StatCard, MetricCard, ListCard, SectionCard, MetricBlock, DashboardWidgetShell, DataListRow.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Total Leads"
                value={demoLeadCount.toLocaleString()}
                icon={TrendingUp}
                variant="mint"
                subValue="+12%"
                delta={{ value: '+12%', direction: 'up' }}
                active
              />
              <MetricCard label="Win rate" value="29%" delta={4} trend="up" periodLabel="vs last week" variant="mint" />
              <StatCard label="Overdue" value="7" icon={Bell} variant="rose" delta={{ value: '-2', direction: 'down' }} />
              <MetricBlock label="SLA Breaches" value={4} sub="this week" tone="rose" />
            </div>
            <VariantRow label="Bump StatCard value">
              <Button size="xs" variant="secondary" onClick={() => setDemoLeadCount((n) => n + Math.floor(Math.random() * 40) + 1)}>
                Bump lead count
              </Button>
            </VariantRow>
            <SectionCard
              title="SectionCard"
              subtitle="Grouped content with header bar"
              actions={<Button size="xs" variant="ghost">Action</Button>}
            >
              <p className="text-sm text-[var(--color-text-secondary)]">
                Filter bars, table wrappers, form sections.
              </p>
            </SectionCard>
            <ListCard
              primary={<span className="tm-data-primary font-semibold">Mobile list row</span>}
              secondary={<span className="tm-data-meta">ListCard — touch-friendly with hover tilt</span>}
              trailing={<Badge variant="in-progress">Active</Badge>}
            />
            <DashboardWidgetShell title="DashboardWidgetShell" actions={<Button size="xs" variant="ghost">Filter</Button>}>
              <div className="divide-y divide-[var(--color-bg-border)]">
                <DataListRow
                  primary={<span className="tm-data-primary">Alpha task</span>}
                  secondary={<span className="tm-data-meta">#TSC · Due today</span>}
                  trailing={<span className="tabular-nums tm-data-meta">4h</span>}
                />
                <DataListRow
                  primary={<span className="tm-data-primary">Beta review</span>}
                  secondary={<span className="tm-data-meta">#CRM · Overdue</span>}
                  trailing={<span className="tabular-nums tm-data-meta">1d</span>}
                />
              </div>
            </DashboardWidgetShell>
          </ShowcaseSection>

          <ShowcaseSection id="tables" title="Tables" description="DataTable with sort, mobile card stack, pagination.">
            <VariantRow label="Compact (no pagination)">
              <div className="w-full">
                <DataTable columns={tableColumns} data={SHOWCASE_TABLE_DATA.slice(0, 3)} paginated={false} />
              </div>
            </VariantRow>
            <VariantRow label="Paginated">
              <div className="w-full">
                <DataTable columns={tableColumns} data={SHOWCASE_TABLE_DATA} paginated pageSize={3} />
              </div>
            </VariantRow>
          </ShowcaseSection>

          <ShowcaseSection id="charts" title="Charts & analytics" description="ChartSurface, TimeframeFilter, DataInsightsLayout, MetricPanelGroup, InsightsChartGrid.">
            <TimeframeFilter value={timeframe} onChange={setTimeframe} />
            <ChartSurface title="ChartSurface" height={180}>
              <div className="flex h-full items-end gap-2 px-2 pb-2">
                {chartPreviewData.map((row) => (
                  <div
                    key={row.date}
                    className="flex-1 rounded-t bg-[var(--color-action-primary)]/70"
                    style={{ height: `${(row.value / 31) * 100}%` }}
                    title={`${row.date}: ${row.value}`}
                  />
                ))}
              </div>
            </ChartSurface>
            <DataInsightsLayout
              header={(
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  DataInsightsLayout — KPI panels + chart grid + detail slot
                </p>
              )}
              panels={[{
                id: 'kpis',
                title: 'MetricPanelGroup',
                metrics: [
                  { id: 'a', label: 'Qualified', value: 184, sub: '+12 vs last week', tone: 'mint' },
                  { id: 'b', label: 'Open rate', value: '42%', tone: 'default' },
                ],
              }]}
              panelColumns={1}
              charts={[{
                id: 'line',
                title: 'InsightsChartGrid',
                type: 'line',
                data: chartPreviewData,
                xKey: 'date',
                dataKey: 'value',
              }]}
              chartColumns={1}
              chartsEager
            />
          </ShowcaseSection>

          <ShowcaseSection
            id="layout"
            title="Layout & page chrome"
            description="PageHeader, PageToolbar, ListPageLayout (with SelectionFilterPanel), HubPageLayout, MobileCollapsibleSection, DesktopRecommendedBanner."
          >
            <DesktopRecommendedBanner />
            <MobileCollapsibleSection title="MobileCollapsibleSection" defaultOpen>
              <p className="text-sm text-[var(--color-text-secondary)]">Collapsible block for mobile hub sections.</p>
            </MobileCollapsibleSection>
            <HubPageLayout
              header={(
                <ModuleSubnav
                  title="Office"
                  titleIcon={Briefcase}
                  mode="tabs"
                  activeId="notes"
                  onTabChange={() => {}}
                  tabsFitContent
                  items={[
                    { id: 'notes', label: 'Notes', icon: StickyNote },
                    { id: 'equipment', label: 'Equipment', icon: Database },
                  ]}
                />
              )}
            >
              <Card className="p-4">
                <p className="text-xs text-[var(--color-text-secondary)]">HubPageLayout panel content area.</p>
              </Card>
            </HubPageLayout>
            <ListPageLayout
              overview={{
                stats: [
                  { id: 'a', label: 'Total', value: 42, icon: Database, variant: 'mint' },
                  { id: 'b', label: 'Active', value: 12, icon: TrendingUp, variant: 'info' },
                ],
              }}
              filterFields={showcaseFilterFields}
              filterSheetTitle="Demo filters"
              mobileFilterCount={countActiveFilters(showcaseFilterFields)}
              onActiveFiltersClear={() => setVisibilityFilter('all')}
              searchBar={(
                <SearchInput
                  variant="toolbar"
                  placeholder="Filter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full max-w-full"
                />
              )}
              toolbarActions={<Button size="sm"><Plus size={14} /> Add</Button>}
            >
              <DataTable columns={tableColumns} data={SHOWCASE_TABLE_DATA.slice(0, 3)} paginated={false} />
            </ListPageLayout>
            <PageToolbar
              title="PageToolbar"
              filterFields={showcaseFilterFields}
              filterSheetTitle="Toolbar filters"
              actions={<Button size="sm" variant="secondary">Export</Button>}
            >
              <SearchInput variant="toolbar" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </PageToolbar>
            <VariantRow label="Skeletons">
              <Button size="sm" variant="secondary" onClick={() => setShowSkeletonPreview((v) => !v)}>
                {showSkeletonPreview ? 'Hide' : 'Show'} PageSkeleton
              </Button>
            </VariantRow>
            {showSkeletonPreview && (
              <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden max-h-[320px] overflow-y-auto">
                <PageSkeleton />
              </div>
            )}
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Also used: ListPageSkeleton, HubPageSkeleton, TableSkeleton, DashboardPageSkeleton, RouteContentSkeleton, PageLoadGuard.
            </p>
          </ShowcaseSection>

          <ShowcaseSection id="modals" title="Modals" description="NexusModal (confirm + custom) and ModalShell (composable).">
            <VariantRow label="Open examples">
              <Button size="sm" onClick={() => setConfirmOpen(true)}>NexusModal confirm</Button>
              <Button size="sm" variant="secondary" onClick={() => setShellOpen(true)}>ModalShell</Button>
              <Button size="sm" variant="ghost" onClick={() => setCenterOpen(true)}>NexusModal custom</Button>
            </VariantRow>
            <NexusModal
              isOpen={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              title="Delete item?"
              message="This action cannot be undone."
              type="danger"
              isConfirm
              onConfirm={() => setConfirmOpen(false)}
              confirmLabel="Delete"
            />
            <ModalShell isOpen={shellOpen} onClose={() => setShellOpen(false)} size="md">
              <ModalHeader title="ModalShell" onClose={() => setShellOpen(false)} />
              <ModalBody>
                <p className="text-sm text-[var(--color-text-secondary)]">Composable modal with header, body, footer.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" size="sm" onClick={() => setShellOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={() => setShellOpen(false)}>Save</Button>
              </ModalFooter>
            </ModalShell>
            <NexusModal isOpen={centerOpen} onClose={() => setCenterOpen(false)} title="Custom dialog" size="sm" showFooter={false}>
              <p className="text-sm text-[var(--color-text-secondary)]">NexusModal with showFooter=false for forms.</p>
              <Button size="sm" className="mt-4" onClick={() => setCenterOpen(false)}>Close</Button>
            </NexusModal>
          </ShowcaseSection>

          <ShowcaseSection id="forms" title="Forms" description="AddMembers picker — used on project/team member flows.">
            <AddMembers
              variant="picker"
              users={SHOWCASE_MOCK_USERS}
              excludeIds={['u2']}
              onAdd={async () => {}}
              title="Add teammates"
              subtitle="Search & pick list"
            />
          </ShowcaseSection>

          <ShowcaseSection id="feedback" title="Feedback & states" description="Banner, QueryErrorBanner, EmptyState, ProgressBar, Accordion. Full-page errors → #error-page.">
            <Banner variant="info" message="Banner — info variant with accent bar." />
            <Banner
              variant="error"
              message="Query failed — inline list errors use QueryErrorBanner."
              actions={<Button size="sm" variant="secondary">Retry</Button>}
            />
            <QueryErrorBanner
              message="Could not load records. Check your connection."
              onRetry={() => emitSystemEvent({ severity: SEVERITY.INFO, message: 'Retry clicked', module: MODULE.SYSTEM, id: 'showcase-query-retry' })}
            />
            <ProgressBar progress={65} />
            <EmptyState title="No items found" actionLabel="Add item" onAction={() => {}} variant="dashed" />
            <Accordion
              items={[
                { title: 'Accordion item 1', content: 'Expandable content block.' },
                { title: 'Accordion item 2', content: 'Another section.' },
              ]}
            />
          </ShowcaseSection>

          <ShowcaseSection
            id="error-page"
            title="AppErrorPage"
            description="Boot failures, RouteErrorBoundary, AppBootError. Support: admin@theshakticollective.in"
          >
            <VariantRow label="Scenario">
              {Object.entries(ERROR_SHOWCASE_VARIANTS).map(([key, variant]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={errorVariant === key ? 'primary' : 'secondary'}
                  onClick={() => setErrorVariant(key)}
                >
                  {variant.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setErrorFullscreen(true)}>
                Fullscreen preview
              </Button>
            </VariantRow>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Desktop</p>
                <AppErrorPage
                  {...activeErrorDemo}
                  onRetry={() => emitSystemEvent({ severity: SEVERITY.INFO, message: 'Try again', module: MODULE.SYSTEM, id: 'showcase-error-retry' })}
                  onGoDashboard={() => emitSystemEvent({ severity: SEVERITY.INFO, message: 'Dashboard', module: MODULE.SYSTEM, id: 'showcase-error-dashboard' })}
                  className={embeddedErrorClass}
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Mobile (390px)</p>
                <div className="mx-auto w-full max-w-[390px]">
                  <AppErrorPage {...activeErrorDemo} onRetry={() => {}} onGoDashboard={() => {}} className={embeddedErrorClass} />
                </div>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="notifications" title="Toasts" description="emitSystemEvent — deduped by id.">
            <VariantRow label="Severity">
              <Button
                size="sm"
                variant="primary"
                onClick={() => emitSystemEvent({ severity: SEVERITY.SUCCESS, message: 'Task approved.', module: MODULE.SYSTEM, id: 'showcase-success' })}
              >
                Success
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => emitSystemEvent({ severity: SEVERITY.WARN, message: 'Deadline in 24 hours.', module: MODULE.SYSTEM, id: 'showcase-warning' })}
              >
                Warning
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => emitSystemEvent({
                  severity: SEVERITY.ERROR,
                  title: 'Failed to sync CSV',
                  message: 'Failed to sync CSV data',
                  description: 'Column mapping mismatch.',
                  technicalError: "TypeError: Cannot read properties of undefined (reading 'map')",
                  module: MODULE.SYSTEM,
                  id: 'showcase-error',
                })}
              >
                Error + details
              </Button>
            </VariantRow>
            <VariantRow label="Dedupe (5× same id)">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  for (let i = 0; i < 5; i += 1) {
                    emitSystemEvent({
                      severity: SEVERITY.ERROR,
                      title: 'Attendance failed',
                      message: 'Attendance Verification Failed',
                      technicalError: `ERR_NETWORK_IP_MISMATCH: attempt ${i + 1}`,
                      module: MODULE.ATTENDANCE,
                      id: 'attendance-error-lock',
                    });
                  }
                }}
              >
                Fire 5×
              </Button>
            </VariantRow>
          </ShowcaseSection>

          <ShowcaseSection id="loading" title="Loading" description="Spinner, LoadingState, DataLoading, BrandedLoadingPanel, Skeleton.">
            <VariantRow label="Spinner">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
              <Spinner size="boot" showPhrase />
            </VariantRow>
            <LoadingState className="!py-6 border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]" />
            <DataLoading className="!py-8 border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]" />
            <BrandedLoadingPanel minHeight="min-h-[12rem]" className="border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]" />
            <VariantRow label="Skeleton">
              <Skeleton width={120} height={16} />
              <Skeleton width={80} height={16} variant="text" />
              <Skeleton width={32} height={32} variant="circle" />
            </VariantRow>
            <ListPageSkeleton />
          </ShowcaseSection>

          <ShowcaseSection id="avatars" title="Avatars" description="UserAvatar + UserLabel — roster, mentions, assignees.">
            <VariantRow label="Sizes">
              <UserAvatar name="Alex Rivera" size="sm" />
              <UserAvatar name="Sam Chen" size="md" />
              <UserAvatar name="Jordan Lee" size="lg" />
            </VariantRow>
            <UserLabel user={SHOWCASE_MOCK_USERS[0]} subtitle={SHOWCASE_MOCK_USERS[0].email} />
          </ShowcaseSection>

          <ShowcaseSection id="brand-loaders" title="Brand loaders" description="Fluid ribbon variants — DEFAULT_LOADER_VARIANT in brand config.">
            <FluidRibbonLoaderGallery />
          </ShowcaseSection>
        </div>
      )}

      <Card className="p-4 border-l-4 border-l-[var(--color-pastel-mint-text)] bg-[var(--color-pastel-mint-bg)]/30">
        <p className="text-xs font-bold text-[var(--color-text-primary)]">Production component index</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Boot/error: AppErrorPage, AppBootError, BootScreen, RouteErrorBoundary, QueryErrorSlot.
          Internal-only (not direct imports): SelectionFilterPanel, FilterFields, InsightsChartGrid, TransitionCard, NumberPopIn.
        </p>
      </Card>

      {errorFullscreen ? (
        <div className="fixed inset-0 z-[200]">
          <AppErrorPage
            {...activeErrorDemo}
            onRetry={() => setErrorFullscreen(false)}
            onGoDashboard={() => setErrorFullscreen(false)}
          />
          <Button
            size="sm"
            variant="secondary"
            className="fixed right-4 top-4 z-[210] shadow-md"
            onClick={() => setErrorFullscreen(false)}
          >
            Close preview
          </Button>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default ComponentsShowcase;
