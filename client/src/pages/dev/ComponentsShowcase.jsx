import React, { useState } from 'react';
import {
  Plus, Search, Trash2, Settings, Database, TrendingUp, Inbox, Bell, Edit2,
} from 'lucide-react';
import { notify } from '../../lib/notifications';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Input,
  FormFieldGrid,
  Badge,
  StatCard,
  TabSwitcher,
  Switch,
  ProgressBar,
  Accordion,
  DataTable,
  Skeleton,
  NexusDropdown,
  NexusModal,
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  CenteredModal,
  EmptyState,
  AddMembers,
  SearchInput,
  IconButton,
  SectionCard,
  Spinner,
  LoadingState,
  PageSkeleton,
} from '../../components/ui';

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

  const tableColumns = [
    { header: 'Name', key: 'name' },
    { header: 'Owner', key: 'owner' },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge variant={row.status}>{row.status}</Badge>,
    },
  ];

  return (
    <PageContainer maxWidth="1200px">
      <PageHeader
        icon={Settings}
        title="Component Library"
        subtitle="Phase 1 preview — review variants before project-wide rollout"
        actions={
          <Button size="sm" variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
          </Button>
        }
      />

      {/* Quick nav */}
      <Card className="p-3 sticky top-2 z-10 bg-[var(--color-bg-surface)]/95 backdrop-blur-sm">
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          {[
            ['buttons', 'Buttons'],
            ['inputs', 'Inputs'],
            ['badges', 'Badges'],
            ['cards', 'Cards'],
            ['dropdowns', 'Dropdowns'],
            ['modals', 'Modals'],
            ['tables', 'Tables'],
            ['feedback', 'Feedback'],
            ['notifications', 'Notifications'],
            ['add-members', 'Add members'],
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
            Design tokens from <code className="text-[10px]">index.css</code> — cream/teal brand, pastel semantic badges.
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
          description="Primary system uses primitives Button (CSS vars). Shadcn Button available for future Radix-nova migration."
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
          <VariantRow label="Shadcn Button (Phase 2 — deps not installed)">
            <p className="text-xs text-[var(--color-text-muted)] italic">
              button.jsx exists at components/ui/button.jsx — needs class-variance-authority + radix-ui
            </p>
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
            <StatCard label="Total Leads" value="1,284" icon={TrendingUp} variant="mint" subValue="+12%" />
            <StatCard label="Pipeline" value="₹4.2L" icon={Database} variant="info" />
            <StatCard label="Overdue" value="7" icon={Bell} variant="rose" />
            <StatCard label="Neutral" value="42" icon={Inbox} variant="slate" />
          </div>
          <SectionCard
            title="Section Card"
            subtitle="Grouped content with header bar"
            actions={<Button size="xs" variant="ghost">Action</Button>}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">
              Use SectionCard for filter bars, table wrappers, and form sections.
            </p>
          </SectionCard>
          <Card hover className="p-4 max-w-xs cursor-pointer">
            <p className="text-xs font-bold">Hover Card</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Interactive surface variant</p>
          </Card>
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
          description="NexusModal (confirm dialogs), ModalShell (composable), CenteredModal (custom content)."
        >
          <VariantRow label="Open examples">
            <Button size="sm" onClick={() => setConfirmOpen(true)}>NexusModal confirm</Button>
            <Button size="sm" variant="secondary" onClick={() => setShellOpen(true)}>ModalShell</Button>
            <Button size="sm" variant="ghost" onClick={() => setCenterOpen(true)}>CenteredModal</Button>
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

          <CenteredModal isOpen={centerOpen} onClose={() => setCenterOpen(false)} size="sm">
            <div className="p-6 space-y-4">
              <h3 className="font-bold">Centered Modal</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Minimal wrapper for bespoke dialogs.</p>
              <Button size="sm" onClick={() => setCenterOpen(false)}>Close</Button>
            </div>
          </CenteredModal>
        </ShowcaseSection>

        <ShowcaseSection id="tables" title="Data Table" description="Virtualized rows, mobile card stack, pagination.">
          <DataTable
            columns={tableColumns}
            data={SHOWCASE_TABLE_DATA}
            defaultPageSize={5}
            paginated={false}
          />
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
          <LoadingState message="Fetching data..." className="!py-6 border border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]" />
          <EmptyState
            title="No items found"
            actionLabel="Add item"
            onAction={() => {}}
            variant="dashed"
          />
          <VariantRow label="Skeleton">
            <Skeleton width={120} height={16} />
            <Skeleton width={80} height={16} variant="text" />
            <Skeleton width={32} height={32} variant="circle" />
          </VariantRow>
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
          description="Central notify API — deduped by id. Spam-click buttons to verify only one toast updates."
        >
          <VariantRow label="Severity">
            <Button
              size="sm"
              variant="primary"
              onClick={() => notify.success('Task approved successfully.', 'showcase-success')}
            >
              Success
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                notify.warning('Task deadline is 24 hours away.', 'showcase-warning')
              }
            >
              Warning
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                notify.error({
                  title: 'Failed to sync CSV data',
                  description: 'Column mapping mismatch detected.',
                  technicalError:
                    "TypeError: Cannot read properties of undefined (reading 'map') at CSVParser.handleSync (line 42)",
                  uniqueKey: 'showcase-error',
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
                  notify.error({
                    title: 'Attendance Verification Failed',
                    description: 'Unverified IP address.',
                    technicalError: `ERR_NETWORK_IP_MISMATCH: attempt ${i + 1}`,
                    uniqueKey: 'attendance-error-lock',
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

        <ShowcaseSection id="layout" title="Layout & Page Chrome" description="PageContainer wraps pages. PageHeader is used at the top of each route (see this page).">
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

      {/* Phase 2 note */}
      <Card className="p-4 border-l-4 border-l-[var(--color-action-primary)] bg-[var(--color-pastel-mint-bg)]/30">
        <p className="text-xs font-bold text-[var(--color-text-primary)]">Phase 2 migration candidates</p>
        <ul className="mt-2 text-xs text-[var(--color-text-secondary)] space-y-1 list-disc list-inside">
          <li>Replace inline search fields with SearchInput (AssetsPage, FinancePage, OfficeAssetsPage)</li>
          <li>Replace inline empty states with EmptyState (ProjectsView, AdminLogsPage, etc.)</li>
          <li>Pick one Button system: primitives vs Shadcn</li>
          <li>Migrate bespoke modals (TaskDetailModal, TaskCreateModal) to ModalShell</li>
        </ul>
      </Card>
    </PageContainer>
  );
};

export default ComponentsShowcase;
