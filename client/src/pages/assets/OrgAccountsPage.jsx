import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  AtSign, Eye, EyeOff, Globe, KeyRound, Link2, Mail, Plus, RefreshCw, Trash2,
} from 'lucide-react';
import ProjectMultiSelect from '../../components/forms/ProjectMultiSelect';
import MemberSelect from '../../components/forms/MemberSelect';
import { WorkspaceDot } from '../../components/forms/WorkspaceSelect';
import {
  Badge, Button, Input, ListPageLayout, NexusDropdown, PageLoadGuard, PageSkeleton,
  SearchInput, DataTable, UserLabel,
} from '../../components/ui';
import { NexusModal, ModalFooter } from '../../components/ui/modals';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const CATEGORIES = [
  { value: 'email', label: 'Email' },
  { value: 'social', label: 'Social' },
  { value: 'platform', label: 'Platform' },
  { value: 'other', label: 'Other' },
];

const PLATFORM_PRESETS = [
  'Instagram', 'YouTube', 'Facebook', 'Spotify', 'Twitter/X', 'LinkedIn',
  'TikTok', 'Google Workspace', 'Exly', 'Notion', 'Canva', 'Zoom', 'Other',
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const EMPTY_FORM = {
  label: '',
  category: 'social',
  platform: 'Instagram',
  platformCustom: '',
  identifier: '',
  url: '',
  loginEmail: '',
  secret: '',
  projectIds: [],
  managedBy: [],
  notes: '',
  status: 'active',
};

const CATEGORY_VARIANT = {
  email: 'info',
  social: 'mint',
  platform: 'apricot',
  other: 'neutral',
};

const normalizeUsers = (users) => {
  if (!users) return [];
  return Array.isArray(users) ? users : [users];
};

const userIdsFromDoc = (doc) =>
  normalizeUsers(doc?.managedBy)
    .map((entry) => (typeof entry === 'object' ? entry?._id : entry))
    .filter(Boolean);

const projectIdsFromDoc = (doc) =>
  (doc?.projectIds || [])
    .map((entry) => (typeof entry === 'object' ? entry?._id : entry))
    .filter(Boolean);

const resolvedPlatform = (form) => {
  if (form.platform === 'Other') return form.platformCustom.trim();
  return form.platform.trim();
};

const toFormData = (account) => {
  const preset = PLATFORM_PRESETS.includes(account.platform) ? account.platform : 'Other';
  return {
    label: account.label || '',
    category: CATEGORIES.some((c) => c.value === account.category) ? account.category : 'other',
    platform: preset,
    platformCustom: preset === 'Other' ? (account.platform || '') : '',
    identifier: account.identifier || '',
    url: account.url || '',
    loginEmail: account.loginEmail || '',
    secret: account.secret || '',
    projectIds: projectIdsFromDoc(account),
    managedBy: userIdsFromDoc(account),
    notes: account.notes || '',
    status: STATUS_OPTIONS.some((s) => s.value === account.status) ? account.status : 'active',
  };
};

const toPayload = (form) => ({
  label: form.label.trim(),
  category: form.category,
  platform: resolvedPlatform(form),
  identifier: form.identifier.trim(),
  url: form.url.trim(),
  loginEmail: form.loginEmail.trim(),
  secret: form.secret,
  projectIds: (form.projectIds || []).filter(Boolean),
  managedBy: (form.managedBy || []).filter(Boolean),
  notes: form.notes.trim() || undefined,
  status: form.status,
});

const openExternalUrl = (url) => {
  const trimmed = url?.trim();
  if (!trimmed) return;
  const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  window.open(href, '_blank', 'noopener,noreferrer');
};

const projectFromLabel = (label) => {
  const parts = String(label || '').split(' — ');
  return parts.length > 1 ? parts[0].trim() : 'Org-wide';
};

const topCounts = (items, limit = 3) =>
  Object.entries(
    items.reduce((acc, { name, count }) => {
      if (!name) return acc;
      acc[name] = (acc[name] || 0) + count;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));

const topPlatformsInCategory = (accounts, category, limit = 3) =>
  topCounts(
    accounts
      .filter((account) => account.category === category)
      .map((account) => ({ name: account.platform || 'Other', count: 1 })),
    limit
  );

const topProjects = (accounts, limit = 3) =>
  topCounts(
    accounts.map((account) => ({ name: projectFromLabel(account.label), count: 1 })),
    limit
  );

const OrgAccountsPage = () => {
  const { confirm } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableSort, setTableSort] = useState({ key: 'label', direction: 'asc' });
  const [showSecret, setShowSecret] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formBaseline, setFormBaseline] = useState(EMPTY_FORM);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['org-accounts'],
    queryFn: async () => (await axios.get('/api/org-accounts')).data,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await axios.get('/api/projects')).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) =>
      editing
        ? axios.put(`/api/org-accounts/${editing._id}`, data)
        : axios.post('/api/org-accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-accounts'] });
      setIsModalOpen(false);
      setEditing(null);
      setFormData(EMPTY_FORM);
      setShowSecret(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => axios.delete(`/api/org-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-accounts'] });
      setIsModalOpen(false);
      setEditing(null);
      setFormData(EMPTY_FORM);
      setShowSecret(false);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => axios.post('/api/org-accounts/import-sheet'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['org-accounts'] });
      const { created = 0, deleted = 0 } = res.data || {};
      toast.success(`Replaced ${deleted} old accounts with ${created} imported`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Sheet import failed');
    },
  });

  const handleImportFromSheet = async () => {
    const ok = await confirm({
      title: 'Import from Google Sheet?',
      message: 'Replaces all Managed Accounts with data from every tab in the credentials spreadsheet (The Shakti Collective, Divine Hanuman, etc.).',
      confirmLabel: 'Replace & Import',
      type: 'danger',
    });
    if (ok) importMutation.mutate();
  };

  const loadForEdit = async (account) => {
    const res = await axios.get(`/api/org-accounts/${account._id}`);
    const loaded = toFormData(res.data);
    setEditing(account);
    setFormData(loaded);
    setFormBaseline(cloneSnapshot(loaded));
    setShowSecret(false);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormBaseline(EMPTY_FORM);
    setShowSecret(false);
    setIsModalOpen(true);
  };

  const hasEdits = isModalOpen && editing && !stableJsonEqual(formData, formBaseline);

  const { revert: revertEdits } = useUnsavedChanges({
    baseline: formBaseline,
    draft: formData,
    setDraft: setFormData,
    hasChanges: hasEdits,
    onSave: () => saveMutation.mutate(toPayload(formData)),
    enabled: false,
    isSaving: saveMutation.isPending,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (categoryFilter !== 'all' && account.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && account.status !== statusFilter) return false;
      if (projectFilter === 'org-wide') {
        if ((account.projectIds || []).length > 0) return false;
      } else if (projectFilter !== 'all') {
        const ids = (account.projectIds || []).map((p) => String(typeof p === 'object' ? p._id : p));
        if (!ids.includes(String(projectFilter))) return false;
      }
      if (!term) return true;
      const haystack = [
        account.label,
        account.platform,
        account.identifier,
        account.loginEmail,
        account.url,
        account.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [accounts, search, categoryFilter, projectFilter, statusFilter]);

  const categoryCounts = useMemo(() => {
    const counts = { email: 0, social: 0, platform: 0, other: 0 };
    for (const account of accounts) {
      if (counts[account.category] != null) counts[account.category] += 1;
    }
    return counts;
  }, [accounts]);

  const topEmailPlatforms = useMemo(() => topPlatformsInCategory(accounts, 'email'), [accounts]);
  const topSocialPlatforms = useMemo(() => topPlatformsInCategory(accounts, 'social'), [accounts]);
  const topPlatformPlatforms = useMemo(() => topPlatformsInCategory(accounts, 'platform'), [accounts]);
  const topProjectsList = useMemo(() => topProjects(accounts), [accounts]);

  const applyCategoryCard = useCallback((category) => {
    setCategoryFilter((prev) => (prev === category ? 'all' : category));
    setTableSort(
      category === 'all'
        ? { key: 'label', direction: 'asc' }
        : { key: 'platform', direction: 'asc' }
    );
  }, []);

  const overviewStats = useMemo(() => [
    {
      id: 'total',
      label: 'Total Accounts',
      value: accounts.length,
      icon: KeyRound,
      variant: 'info',
      highlights: topProjectsList,
      info: 'Top projects by account count. Click to show all.',
      onClick: () => applyCategoryCard('all'),
      active: categoryFilter === 'all',
    },
    {
      id: 'email',
      label: 'Email',
      value: categoryCounts.email,
      icon: Mail,
      variant: 'info',
      highlights: topEmailPlatforms,
      info: 'Top email platforms. Click to filter and sort.',
      onClick: () => applyCategoryCard('email'),
      active: categoryFilter === 'email',
    },
    {
      id: 'social',
      label: 'Social',
      value: categoryCounts.social,
      icon: Globe,
      variant: 'mint',
      highlights: topSocialPlatforms,
      info: 'Top social platforms. Click to filter and sort.',
      onClick: () => applyCategoryCard('social'),
      active: categoryFilter === 'social',
    },
    {
      id: 'platform',
      label: 'Platform',
      value: categoryCounts.platform,
      icon: AtSign,
      variant: 'apricot',
      highlights: topPlatformPlatforms,
      info: 'Top SaaS/platform logins. Click to filter and sort.',
      onClick: () => applyCategoryCard('platform'),
      active: categoryFilter === 'platform',
    },
  ], [accounts.length, applyCategoryCard, categoryCounts, categoryFilter, topEmailPlatforms, topPlatformPlatforms, topProjectsList, topSocialPlatforms]);

  const categoryFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c.value, label: c.label }))],
    []
  );

  const projectFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      { value: 'org-wide', label: 'Organization-wide' },
      ...projects.map((project) => ({ value: project._id, label: project.name })),
    ],
    [projects]
  );

  const statusFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))],
    []
  );

  const accountColumns = [
    {
      header: 'Label',
      sortKey: 'label',
      render: (account) => <span className="font-bold">{account.label}</span>,
    },
    {
      header: 'Category',
      sortKey: 'category',
      render: (account) => (
        <Badge variant={CATEGORY_VARIANT[account.category] || 'neutral'}>
          {account.category}
        </Badge>
      ),
    },
    {
      header: 'Platform',
      sortKey: 'platform',
      render: (account) => account.platform || '—',
    },
    {
      header: 'Identifier',
      sortKey: 'identifier',
      render: (account) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          {account.identifier || account.loginEmail || '—'}
        </span>
      ),
    },
    {
      header: 'Projects',
      sortKey: 'projectIds',
      sortFn: (account) => (account.projectIds || []).length,
      render: (account) => {
        const items = account.projectIds || [];
        if (!items.length) {
          return <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Org-wide</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {items.map((project) => (
              <span
                key={project._id || project}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
              >
                <WorkspaceDot workspace={project.workspace} size={6} />
                {project.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      header: 'Managed By',
      sortKey: 'managedBy',
      sortFn: (account) =>
        normalizeUsers(account.managedBy)
          .map((user) => user?.name || '')
          .join(', '),
      render: (account) => {
        const users = normalizeUsers(account.managedBy).filter((user) => user?.name || user?._id);
        if (!users.length) return <span className="text-[var(--color-text-muted)]">—</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {users.map((user) => (
              <UserLabel
                key={user._id || user.name}
                user={user}
                size="xs"
                nameClassName="font-bold text-xs"
              />
            ))}
          </div>
        );
      },
    },
    {
      header: 'Status',
      sortKey: 'status',
      render: (account) => (
        <Badge variant={account.status === 'active' ? 'success' : 'neutral'}>
          {account.status}
        </Badge>
      ),
    },
    {
      header: 'Link',
      sortKey: 'url',
      render: (account) => (
        account.url ? (
          <button
            type="button"
            className="text-[#22d3ee] hover:underline inline-flex items-center gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openExternalUrl(account.url);
            }}
          >
            <Link2 size={12} /> Open
          </button>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )
      ),
    },
  ];

  useEffect(() => {
    if (!isModalOpen) setShowSecret(false);
  }, [isModalOpen]);

  return (
    <PageLoadGuard loading={isLoading && !accounts.length} skeleton={PageSkeleton} className="!py-0">
      <ListPageLayout
        containerClassName="!py-0"
        overview={{ stats: overviewStats }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="tm-toolbar-search--grow"
            />
            <div className="flex flex-nowrap items-center gap-2 shrink-0">
              <NexusDropdown
                options={categoryFilterOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
                placeholder="Category"
                className="!w-32 shrink-0"
              />
              <NexusDropdown
                options={projectFilterOptions}
                value={projectFilter}
                onChange={setProjectFilter}
                placeholder="Project"
                className="!w-32 shrink-0"
              />
              <NexusDropdown
                options={statusFilterOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Status"
                className="!w-28 shrink-0"
              />
            </div>
          </>
        }
        toolbarActions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleImportFromSheet}
              disabled={importMutation.isPending}
            >
              <RefreshCw size={14} className={importMutation.isPending ? 'animate-spin' : ''} />
              Import Sheet
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} /> Add Account
            </Button>
          </div>
        }
      >
        <DataTable
          columns={accountColumns}
          data={filtered}
          onRowClick={(account) => loadForEdit(account)}
          getRowId={(account) => account._id}
          isLoading={isLoading}
          sortState={tableSort}
          onSortChange={setTableSort}
          emptyTitle="No managed accounts"
          emptyDescription="Add social, email, or platform logins your team manages."
        />

        <NexusModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editing ? 'Edit Managed Account' : 'Add Managed Account'}
          showFooter={false}
          width="max-w-3xl"
          footer={
            editing ? (
              <ModalFooter>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={revertEdits}
                  disabled={!hasEdits || saveMutation.isPending}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="success"
                  onClick={() => saveMutation.mutate(toPayload(formData))}
                  disabled={!hasEdits || saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </ModalFooter>
            ) : null
          }
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing) saveMutation.mutate(toPayload(formData));
            }}
          >
            <Input
              label="Label"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              icon={KeyRound}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1">Category</label>
                <select
                  className="w-full border rounded-lg p-2 bg-transparent"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Platform</label>
                <select
                  className="w-full border rounded-lg p-2 bg-transparent"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                >
                  {PLATFORM_PRESETS.map((platform) => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Status</label>
                <select
                  className="w-full border rounded-lg p-2 bg-transparent"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.platform === 'Other' && (
              <Input
                label="Custom Platform"
                value={formData.platformCustom}
                onChange={(e) => setFormData({ ...formData, platformCustom: e.target.value })}
                placeholder="e.g. Vimeo, Discord"
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Identifier / Username"
                value={formData.identifier}
                onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                icon={AtSign}
                placeholder="@handle or account ID"
              />
              <Input
                label="Login Email"
                type="email"
                value={formData.loginEmail}
                onChange={(e) => setFormData({ ...formData, loginEmail: e.target.value })}
                icon={Mail}
                placeholder="login@company.com"
              />
            </div>

            <Input
              label="Profile / Login URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              icon={Link2}
              placeholder="https://instagram.com/..."
            />

            <div className="relative">
              <Input
                label="Password / API Key"
                type={showSecret ? 'text' : 'password'}
                value={formData.secret}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                placeholder={editing ? 'Leave blank to keep saved password' : 'Optional secret'}
              />
              <button
                type="button"
                className="absolute right-3 top-[2.1rem] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                onClick={() => setShowSecret((prev) => !prev)}
                aria-label={showSecret ? 'Hide password' : 'Show password'}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {editing?.hasSecret && !formData.secret && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  A password is saved. Enter a new value to replace it.
                </p>
              )}
            </div>

            <ProjectMultiSelect
              projects={projects}
              value={formData.projectIds}
              onChange={(val) => setFormData({ ...formData, projectIds: Array.isArray(val) ? val : [val].filter(Boolean) })}
              label="Associated Projects"
              placeholder="Leave empty for organization-wide"
            />

            <MemberSelect
              label="Managed By"
              value={formData.managedBy}
              onChange={(managedBy) => setFormData({ ...formData, managedBy })}
              placeholder="Select team members..."
              multi
            />

            <Input
              label="Notes"
              multiline
              rows={3}
              autoGrow
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="flex items-center gap-2">
              {!editing && (
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Add Account'}
                </Button>
              )}
              {editing && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete managed account?',
                      message: `Delete "${editing.label}"?`,
                      confirmLabel: 'Delete',
                      type: 'danger',
                    });
                    if (ok) deleteMutation.mutate(editing._id);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </div>
          </form>
        </NexusModal>
      </ListPageLayout>
    </PageLoadGuard>
  );
};

export default OrgAccountsPage;
