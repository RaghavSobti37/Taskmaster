import React, { useState } from 'react';
import {
  Plus, Search, Trash2, Settings, Database, TrendingUp, Inbox, Bell, Edit2,
} from 'lucide-react';
import { emitSystemEvent } from '../../lib/systemLogBridge';
import { SEVERITY, MODULE } from '../../lib/systemLogContract';
import { PageContainer, PageHeader, Button, Card, Input, FormFieldGrid, Badge, StatCard, TabSwitcher, Switch, ProgressBar, Accordion, DataTable, ListPageLayout, Skeleton, NexusDropdown, EmptyState, AddMembers, SearchInput, IconButton, SectionCard, Spinner, LoadingState, PageSkeleton, DashboardWidgetShell, DataListRow, DeltaBadge, DataInsightsLayout, MetricPanelGroup, MetricBlock, InsightsChartGrid, TransitionCard, SkeletonReveal, CountBadge } from '../../components/ui';
import { NexusModal, ModalShell, ModalHeader, ModalBody, ModalFooter } from '../../components/ui/modals';
import { ChartSurface } from '../../components/ui/charts';
import FluidRibbonLoaderGallery from '../../components/brand/FluidRibbonLoaderGallery';
import ModuleSubnavShowcase from '../../components/ui/ModuleSubnavVariants';

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
];

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
  const [activeTab, setActiveTab] = useState('overview');
  const [switchOn, setSwitchOn] = useState(true);
  const [dropdownVal, setDropdownVal] = useState('a');
  const [ckVal, setCkVal] = useState('a');
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [showSkeletonPreview, setShowSkeletonPreview] = useState(false);
  const [demoLeadCount, setDemoLeadCount] = useState(1284);
  const [skelLoaded, setSkelLoaded] = useState(false);

  const tableColumns = [
    { header: 'Name', key: 'name', sortKey: 'name' },
    { header: 'Owner', key: 'owner', sortKey: 'owner' },
    {
      header: 'Status',
      key: 'status',
      sortKey: 'status',
      render: (row) => <Badge variant={row?.status}>{row?.status}</Badge>,
    },
  ];

  return (
    <PageContainer maxWidth="1200px">
      <PageHeader
        icon={Settings}
        title="Component Library"
        actions={
          <Button size="sm" variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
          </Button>
        }
      />

      {/* Quick nav */}
      <Card className="p-3 sticky top-2 z-10 bg-[var(--color-bg-surface)]/95">
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          {[
            ['buttons', 'Buttons'],
            ['inputs', 'Inputs'],
            ['badges', 'Badges'],
            ['cards', 'Cards'],
            ['subtractive', 'Subtractive'],
            ['dropdowns', 'Dropdowns'],
            ['modals', 'Modals'],
            ['tables', 'Tables'],
            ['feedback', 'Feedback'],
            ['notifications', 'Notifications'],
            ['add-members', 'Add members'],
            ['subnav', 'Module subnav'],
            ['insights-layout', 'Insights layout'],
            ['brand-logos', 'Brand loaders'],
            ['transitions', 'Transitions'],
            ['layout', 'Layout'],
          ].map(([id, label]) => (
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
          { id: 'overview', label: 'Overview' },
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

      <div className="space-y-8">
        <ShowcaseSection
          id="buttons"
          title="Buttons"
          description="Primitives Button only — shadcn removed."
        >
          <VariantRow label="Primitives — variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="mint">Mint</Button>
          </VariantRow>
          <VariantRow label="Primitives — sizes">
            <Button size="xs">XS</Button>
            <Button size="sm">SM</Button>
            <Button size="md">MD</Button>
            <Button size="lg">LG</Button>
          </VariantRow>
          <VariantRow label="Primitives — with icon">
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

        <ShowcaseSection
          id="inputs"
          title="Inputs & Search"
          description="Input supports label, icon, multiline. SearchInput adds clear button."
        >
          <FormFieldGrid>
            <Input label="Text field" placeholder="Enter value..." />
            <Input label="With icon" icon={Database} placeholder="Search database..." />
            <SearchInput
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search with clear..."
            />
            <Input label="Multiline" multiline rows={3} placeholder="Notes..." />
          </FormFieldGrid>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-bg-border)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">Switch</p>
            <Switch checked={switchOn} onChange={setSwitchOn} />
            <span className="text-xs text-[var(--color-text-muted)]">{switchOn ? 'On' : 'Off'}</span>
          </div>
        </ShowcaseSection>

        <ShowcaseSection id="badges" title="Badges" description="Pastel semantic badges mapped to status keywords.">
          <VariantRow label="Semantic">
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="medium">Medium</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="in-progress">In Progress</Badge>
            <Badge variant="overdue">Overdue</Badge>
            <Badge variant="hot">Hot</Badge>
          </VariantRow>
        </ShowcaseSection>

        <ShowcaseSection id="cards" title="Cards & Stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Leads" value={demoLeadCount.toLocaleString()} icon={TrendingUp} variant="mint" subValue="+12%" delta={{ value: '+12%', direction: 'up' }} active />
            <StatCard label="Pipeline" value="₹4.2L" icon={Database} variant="info" />
            <StatCard label="Overdue" value="7" icon={Bell} variant="rose" delta={{ value: '-2', direction: 'down' }} />
            <StatCard label="Neutral" value="42" icon={Inbox} variant="slate" />
          </div>
          <VariantRow label="Number pop-in">
            <Button size="xs" variant="secondary" onClick={() => setDemoLeadCount((n) => n + Math.floor(Math.random() * 40) + 1)}>
              Bump lead count
            </Button>
          </VariantRow>
          <SectionCard
            title="Section Card"
            subtitle="Grouped content with header bar"
            actions={<Button size="xs" variant="ghost">Action</Button>}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">
              Use SectionCard for filter bars, table wrappers, and form sections.
            </p>
          </SectionCard>
          <TransitionCard innerClassName="p-4 max-w-xs cursor-pointer rounded-[var(--radius-atomic)] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]" maxDeg={10}>
            <p className="text-xs font-bold">Hover Card (3D tilt)</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">TransitionCard — transitions.dev card-tilt</p>
          </TransitionCard>
        </ShowcaseSection>

        <ShowcaseSection
          id="subtractive"
          title="Subtractive UI"
          description="Flat surfaces, rule dividers, typography hierarchy — no nested card boxes or static shadows."
        >
          <VariantRow label="Delta badges">
            <DeltaBadge value="+12%" direction="up" />
            <DeltaBadge value="-8%" direction="down" />
          </VariantRow>
          <DashboardWidgetShell title="Widget shell" actions={<Button size="xs" variant="ghost">Filter</Button>}>
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
          <VariantRow label="Ghost input (FSW inline edit)">
            <div className="max-w-sm w-full">
              <Input variant="ghost" defaultValue="Editable field value" />
            </div>
          </VariantRow>
          <VariantRow label="Flush DataTable">
            <div className="w-full">
              <DataTable columns={tableColumns} data={SHOWCASE_TABLE_DATA} paginated={false} />
            </div>
          </VariantRow>
        </ShowcaseSection>

        <ShowcaseSection
          id="dropdowns"
          title="Dropdowns"
        >
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

        <ShowcaseSection
          id="modals"
          title="Modals"
          description="NexusModal first; ModalShell when layout is custom. See docs/COMPONENT_STANDARDS.md."
        >
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
            <ModalHeader title="Modal Shell" onClose={() => setShellOpen(false)} />
            <ModalBody>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Composable modal with header, body, footer slots.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" size="sm" onClick={() => setShellOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => setShellOpen(false)}>Save</Button>
            </ModalFooter>
          </ModalShell>

          <NexusModal isOpen={centerOpen} onClose={() => setCenterOpen(false)} title="Custom dialog" size="sm" showFooter={false}>
            <p className="text-sm text-[var(--color-text-secondary)]">Use NexusModal with showFooter=false for forms.</p>
            <Button size="sm" className="mt-4" onClick={() => setCenterOpen(false)}>Close</Button>
          </NexusModal>
        </ShowcaseSection>

        <ShowcaseSection id="tables" title="Data Table" description="Click column headers: asc → desc → default. Virtualized rows, mobile card stack, pagination.">
          <DataTable
            columns={tableColumns}
            data={SHOWCASE_TABLE_DATA}
            paginated={false}
          />
        </ShowcaseSection>

        <ShowcaseSection id="udif-layout" title="UDIF 2.1 list layout" description="Overview first, then toolbar, then table. No page title when overview is present.">
          <ListPageLayout
            overview={{
              stats: [
                { id: 'a', label: 'Total', value: 42, icon: Database, variant: 'mint' },
                { id: 'b', label: 'Active', value: 12, icon: TrendingUp, variant: 'info' },
              ],
              charts: [
                {
                  id: 'status',
                  title: 'By status',
                  type: 'donut',
                  data: [
                    { label: 'Done', value: 8 },
                    { label: 'Open', value: 4 },
                  ],
                },
              ],
            }}
            toolbar={
              <SearchInput placeholder="Filter…" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-40" />
            }
            toolbarActions={
              <Button size="sm"><Plus size={14} /> Add</Button>
            }
          >
            <DataTable columns={tableColumns} data={SHOWCASE_TABLE_DATA} paginated={false} />
          </ListPageLayout>
        </ShowcaseSection>

        <ShowcaseSection id="feedback" title="Feedback & States">
          <VariantRow label="Progress">
            <div className="w-full max-w-xs space-y-2">
              <ProgressBar progress={65} />
              <ProgressBar progress={30} color="bg-[var(--color-pastel-rose-text)]" />
            </div>
          </VariantRow>
          <VariantRow label="Spinner">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </VariantRow>
          <LoadingState className="!py-6 border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]" />
          <LoadingState showPhrase className="!py-6 border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] mt-4" />
          <EmptyState
            title="No items found"
            actionLabel="Add item"
            onAction={() => {}}
            variant="dashed"
          />
          <VariantRow label="CountBadge (notification pop)">
            <span className="relative inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-bg-border)]">
              <Bell size={14} />
              Inbox
              <CountBadge count={3} variant="teal" />
            </span>
            <CountBadge count={12} variant="warning" pulse />
          </VariantRow>
          <VariantRow label="Skeleton + SkeletonReveal">
            <Skeleton width={120} height={16} />
            <Skeleton width={80} height={16} variant="text" />
            <Skeleton width={32} height={32} variant="circle" />
            <Button size="xs" variant="ghost" onClick={() => setSkelLoaded((v) => !v)}>
              Toggle reveal
            </Button>
          </VariantRow>
          {skelLoaded !== null && (
            <SkeletonReveal
              reveal
              loading={!skelLoaded}
              skeleton={<div className="h-24 rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)]" />}
              className="max-w-sm"
            >
              <p className="text-sm text-[var(--color-text-secondary)] p-4 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                Loaded content cross-fades in after skeleton pulse.
              </p>
            </SkeletonReveal>
          )}
          <Accordion
            items={[
              { title: 'Accordion item 1', content: 'Expandable content block.' },
              { title: 'Accordion item 2', content: 'Another section.' },
            ]}
          />
        </ShowcaseSection>

        <ShowcaseSection
          id="notifications"
          title="Notifications"
          description="emitSystemEvent — deduped by id. Spam-click buttons to verify only one toast updates."
        >
          <VariantRow label="Severity">
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                emitSystemEvent({
                  severity: SEVERITY.SUCCESS,
                  message: 'Task approved successfully.',
                  module: MODULE.SYSTEM,
                  id: 'showcase-success',
                })
              }
            >
              Success
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                emitSystemEvent({
                  severity: SEVERITY.WARN,
                  message: 'Task deadline is 24 hours away.',
                  module: MODULE.SYSTEM,
                  id: 'showcase-warning',
                })
              }
            >
              Warning
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                emitSystemEvent({
                  severity: SEVERITY.ERROR,
                  title: 'Failed to sync CSV data',
                  message: 'Failed to sync CSV data',
                  description: 'Column mapping mismatch detected.',
                  technicalError:
                    "TypeError: Cannot read properties of undefined (reading 'map') at CSVParser.handleSync (line 42)",
                  module: MODULE.SYSTEM,
                  id: 'showcase-error',
                })
              }
            >
              Error + details
            </Button>
          </VariantRow>
          <VariantRow label="Dedupe stress test">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                for (let i = 0; i < 5; i += 1) {
                  emitSystemEvent({
                    severity: SEVERITY.ERROR,
                    title: 'Attendance Verification Failed',
                    message: 'Attendance Verification Failed',
                    description: 'Unverified IP address.',
                    technicalError: `ERR_NETWORK_IP_MISMATCH: attempt ${i + 1}`,
                    module: MODULE.ATTENDANCE,
                    id: 'attendance-error-lock',
                  });
                }
              }}
            >
              Fire 5× same error id
            </Button>
          </VariantRow>
        </ShowcaseSection>

        <ShowcaseSection
          id="add-members"
          title="Add members"
          description="Three layout options — pick one for Phase 2 rollout (projects, teams, etc.)."
        >
        

           
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                Option C — Search & pick list
              </p>
              <AddMembers
                variant="picker"
                users={SHOWCASE_MOCK_USERS}
                excludeIds={['u2', 'u3']}
                onAdd={async () => {}}
                title="Add teammates"
                subtitle="Best when you have many users to scroll"
              />
            
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="subnav"
          title="Module subnav — pick one"
          description="Five layouts for Emails, CRM, Assets, etc. Click tabs in each demo, then tell us A–E to ship app-wide."
        >
          <ModuleSubnavShowcase />
        </ShowcaseSection>

        <ShowcaseSection
          id="insights-layout"
          title="Insights analytics primitives"
          description="DataInsightsLayout, MetricPanelGroup, MetricBlock, and InsightsChartGrid with a live UDIF-style composition."
        >
          <DataInsightsLayout
            header={(
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">Team analytics overview</h3>
                <p className="text-[10px] text-[var(--color-text-muted)]">Three-layer shell: KPI panels, chart grid, then detailed workspace.</p>
              </div>
            )}
            panels={[
              {
                id: 'showcase-kpis',
                title: 'MetricPanelGroup example',
                metricsCols: 2,
                metrics: [
                  { id: 'a', label: 'Qualified Leads', value: 184, sub: '+12 vs last week', tone: 'mint' },
                  { id: 'b', label: 'Open Rate', value: '42%', sub: 'campaign aggregate', tone: 'default' },
                  { id: 'c', label: 'Response Time', value: '3.1h', sub: 'median', tone: 'default' },
                  { id: 'd', label: 'Escalations', value: 7, sub: 'active', tone: 'rose' },
                ],
              },
            ]}
            panelColumns={1}
            charts={[
              {
                id: 'showcase-insights-line',
                title: 'InsightsChartGrid line',
                type: 'line',
                data: [
                  { date: 'Mon', value: 18 },
                  { date: 'Tue', value: 24 },
                  { date: 'Wed', value: 21 },
                  { date: 'Thu', value: 31 },
                  { date: 'Fri', value: 27 },
                ],
                xKey: 'date',
                dataKey: 'value',
              },
              {
                id: 'showcase-insights-bar',
                title: 'InsightsChartGrid area',
                type: 'area',
                data: [
                  { date: 'Email', value: 92 },
                  { date: 'Calls', value: 63 },
                  { date: 'Demo', value: 28 },
                  { date: 'Closed', value: 11 },
                ],
                xKey: 'date',
                dataKey: 'value',
              },
            ]}
            chartColumns={2}
            chartsEager
            toolbar={(
              <div className="flex items-center gap-2 border-t border-[var(--color-bg-border)] pt-3">
                <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter details..." className="!w-56" />
                <Badge variant="info">Toolbar slot</Badge>
              </div>
            )}
          >
            <div className="border-t border-[var(--color-bg-border)] pt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">MetricBlock (standalone)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricBlock label="SLA Breaches" value={4} sub="this week" tone="rose" />
                <MetricBlock label="Resolved" value={58} sub="7d total" tone="mint" />
                <MetricBlock label="Avg Handle" value="12m" sub="support queue" />
                <MetricBlock label="NPS Signals" value="87%" sub="survey sample" />
              </div>
            </div>
            <div className="border-t border-[var(--color-bg-border)] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                InsightsChartGrid (standalone)
              </p>
              <InsightsChartGrid
                eager
                columns={1}
                charts={[
                  {
                    id: 'showcase-standalone-area',
                    title: 'Standalone area chart',
                    type: 'area',
                    data: [
                      { date: 'W1', value: 31 },
                      { date: 'W2', value: 35 },
                      { date: 'W3', value: 29 },
                      { date: 'W4', value: 44 },
                    ],
                    xKey: 'date',
                    dataKey: 'value',
                  },
                ]}
              />
            </div>
            <div className="border-t border-[var(--color-bg-border)] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                MetricPanelGroup (standalone)
              </p>
              <MetricPanelGroup
                columns={1}
                panels={[
                  {
                    id: 'showcase-standalone-panel',
                    title: 'Standalone panel',
                    metrics: [
                      { id: 'pipeline', label: 'Pipeline', value: '₹4.2L', tone: 'default' },
                      { id: 'win-rate', label: 'Win rate', value: '29%', tone: 'mint' },
                      { id: 'risk', label: 'At risk', value: 6, tone: 'rose' },
                    ],
                  },
                ]}
              />
            </div>
          </DataInsightsLayout>
        </ShowcaseSection>

        <ShowcaseSection
          id="transitions"
          title="Transitions.dev map"
          description="Each library primitive uses the best-fit transition from transitions.dev."
        >
          <ul className="text-xs text-[var(--color-text-secondary)] space-y-1.5 list-disc list-inside">
            <li><strong>TabSwitcher / ModuleSubnav / TimeframeFilter</strong> — tabs sliding pill</li>
            <li><strong>NexusDropdown</strong> — menu dropdown</li>
            <li><strong>NexusModal / ModalShell</strong> — modal open/close</li>
            <li><strong>SearchInput (toolbar)</strong> — input clear dissolve</li>
            <li><strong>Input errors</strong> — error state shake</li>
            <li><strong>EmptyState / PageHeader</strong> — texts reveal stagger</li>
            <li><strong>LoadingPhrase</strong> — shimmer text</li>
            <li><strong>StatCard / MetricBlock / DeltaBadge</strong> — number pop-in</li>
            <li><strong>Accordion / MobileCollapsibleSection</strong> — accordion expand</li>
            <li><strong>SkeletonReveal</strong> — skeleton loader reveal</li>
            <li><strong>TransitionCard / MetricCard</strong> — card hover tilt</li>
            <li><strong>CountBadge</strong> — notification badge</li>
            <li><strong>InfoButton (StatCard)</strong> — tooltip</li>
          </ul>
        </ShowcaseSection>

        <ShowcaseSection
          id="brand-logos"
          title="Brand & loading animations"
          description="App logo: Harmonic Frequency (#99). Five fluid-ribbon pulse loaders — copy variant id to change DEFAULT_LOADER_VARIANT."
        >
          <FluidRibbonLoaderGallery />
        </ShowcaseSection>

        <ShowcaseSection id="layout" title="Layout & Page Chrome" description="Prefer ListPageLayout + PageToolbar on data routes. PageHeader for simple pages only; no subtitles.">
          <VariantRow label="Full page skeleton preview">
            <Button size="sm" variant="secondary" onClick={() => setShowSkeletonPreview((v) => !v)}>
              {showSkeletonPreview ? 'Hide' : 'Show'} PageSkeleton
            </Button>
          </VariantRow>
          {showSkeletonPreview && (
            <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden max-h-[400px] overflow-y-auto">
              <PageSkeleton />
            </div>
          )}
          <p className="text-[10px] text-[var(--color-text-muted)]">
            DashboardSkeleton used in App.jsx Suspense fallback — not shown inline here.
          </p>
        </ShowcaseSection>
      </div>

      <Card className="p-4 border-l-4 border-l-[var(--color-pastel-mint-text)] bg-[var(--color-pastel-mint-bg)]/30">
        <p className="text-xs font-bold text-[var(--color-text-primary)]">Phase 2 — complete</p>
        <ul className="mt-2 text-xs text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
          <li>SearchInput on list/admin toolbars (inline search fields migrated)</li>
          <li>EmptyState on ProjectsView, NotesPage, ProjectCreate, WorkspaceSettings, admin tables</li>
          <li>Button system: primitives only</li>
          <li>TaskCreateModal + TaskDetailModal on ModalShell + standard footer buttons</li>
        </ul>
      </Card>
    </PageContainer>
  );
};

export default ComponentsShowcase;
