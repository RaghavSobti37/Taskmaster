import React, { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Upload, RefreshCw, Users, Sheet, UserPlus, AlertCircle, Check, CheckCircle2, ShoppingBag, Database,
} from 'lucide-react';
import { Button, Input, Badge, DataTable, TabSwitcher, NexusDropdown } from '../../ui';
import { useAuth } from '../../../contexts/AuthContext';
import { isAdminUser } from '../../../utils/departmentPermissions';
import { useCRMConfig } from '../../../hooks/queries/crm';
import { useCampaignExlyOfferings, useCampaignDataHubFolders } from '../../../hooks/queries/mail';
import { CAMPAIGN_ENGAGEMENT_FILTER_OPTIONS } from './useCampaignAudience';

const ALL_SOURCE_TILES = [
  { id: 'csv', label: 'CSV Upload', icon: Upload },
  { id: 'holysheet', label: 'HolySheet', icon: Sheet, adminOnly: true },
  { id: 'datahub', label: 'Data Hub', icon: Database, adminOnly: true },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'exly', label: 'Exly', icon: ShoppingBag },
  { id: 'manual', label: 'Manual', icon: UserPlus },
];

export default function StepAudienceMapping({
  audience,
  approvedTemplates = [],
  templateIndices = [],
}) {
  const { user } = useAuth();
  const { watch, setValue } = useFormContext();
  const mailTemplateId = watch('mailTemplateId');
  const variableMapping = watch('variableMapping') || {};
  const showHolySheet = isAdminUser(user);
  const sourceTiles = useMemo(
    () => ALL_SOURCE_TILES.filter((tile) => !tile.adminOnly || showHolySheet),
    [showHolySheet],
  );

  const exlyOfferingsQuery = useCampaignExlyOfferings({
    enabled: audience.audienceSource === 'exly',
  });
  const dataHubFoldersQuery = useCampaignDataHubFolders({
    enabled: audience.audienceSource === 'datahub' && showHolySheet,
  });

  useEffect(() => {
    if (!showHolySheet && (audience.audienceSource === 'holysheet' || audience.audienceSource === 'datahub')) {
      audience.setAudienceSource('csv');
    }
  }, [showHolySheet, audience]);

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => String(t._id) === String(mailTemplateId)),
    [approvedTemplates, mailTemplateId],
  );

  const previewRows = (audience.previewRecipients || []).slice(0, 5);
  const dummyValues = selectedTemplate?.dummyValues || {};

  const { data: crmConfig } = useCRMConfig();
  const leadStatusesList = crmConfig?.leadStatuses || [
    'New', 'Fresh', 'Cold', 'Warm', 'Hot', 'Interested', 'Not Interested',
    'Followup', 'Contacted', 'Converted', 'Lost',
  ];
  const leadStatusOptions = useMemo(
    () => [{ value: 'all', label: 'All statuses' }, ...leadStatusesList.map((s) => ({ value: s, label: s }))],
    [leadStatusesList],
  );
  const exlyOfferingOptions = useMemo(
    () => (exlyOfferingsQuery.data?.offerings || []).map((o) => ({
      value: o.offeringId,
      label: o.title || o.offeringId,
    })).filter((o) => o.value),
    [exlyOfferingsQuery.data?.offerings],
  );
  const artistProjectOptions = [
    { value: 'all', label: 'All artists' },
    { value: 'YUGM', label: 'YUGM' },
    { value: 'Harshad Duhita', label: 'Harshad Duhita' },
    { value: 'shared', label: 'Shared event DB' },
  ];
  const contactCategoryOptions = [
    { value: 'all', label: 'All categories' },
    { value: 'press_media', label: 'Press / media' },
    { value: 'event_organizer', label: 'Event organizer' },
    { value: 'event_database', label: 'Event database' },
  ];

  const dataHubFolderOptions = useMemo(
    () => (dataHubFoldersQuery.data?.folders || []).map((f) => ({
      value: f.key,
      label: `${f.label}${f.count != null ? ` (${f.count})` : ''}`,
    })),
    [dataHubFoldersQuery.data?.folders],
  );

  const isExlySource = audience.audienceSource === 'exly';
  const isDataHubSource = audience.audienceSource === 'datahub';
  const loadedCount = isExlySource
    ? (audience.allExlyContacts?.length ?? 0)
    : isDataHubSource
      ? (audience.allDataHubContacts?.length ?? 0)
      : (audience.allContacts?.length ?? 0);
  const filteredCount = audience.displayContacts?.length ?? 0;
  const selectedIds = isExlySource
    ? audience.selectedExlyIds
    : isDataHubSource
      ? audience.selectedDataHubIds
      : audience.selectedLeadIds;
  const setSelectedIds = isExlySource
    ? audience.setSelectedExlyIds
    : isDataHubSource
      ? audience.setSelectedDataHubIds
      : audience.setSelectedLeadIds;

  const setMapping = (idx, col) => {
    setValue('variableMapping', { ...variableMapping, [idx]: col }, { shouldValidate: true });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className={`grid gap-3 ${sourceTiles.length >= 6 ? 'grid-cols-2 md:grid-cols-6' : sourceTiles.length >= 5 ? 'grid-cols-2 md:grid-cols-5' : sourceTiles.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
        {sourceTiles.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => audience.setAudienceSource(id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
              audience.audienceSource === id
                ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10'
                : 'border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/40'
            }`}
          >
            <Icon size={20} className="text-[var(--color-action-primary)]" />
            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      {audience.audienceSource === 'csv' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
          <label className="cursor-pointer flex items-center justify-center gap-2 px-4 py-8 border border-dashed border-[var(--color-bg-border)] rounded-xl hover:border-[var(--color-action-primary)] transition-colors">
            <Upload size={16} />
            <span className="text-sm font-medium">{audience.csvFileName || 'Upload CSV file'}</span>
            <input type="file" accept=".csv" className="hidden" onChange={audience.handleCsvUpload} />
          </label>
          {audience.csvRecipients.length > 0 && (
            <CampaignEngagementFilter audience={audience} />
          )}
        </div>
      )}

      {audience.audienceSource === 'holysheet' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <Button onClick={audience.fetchHolySheetData} disabled={audience.loadingHolySheet}>
            <RefreshCw size={14} className={audience.loadingHolySheet ? 'animate-spin' : ''} />
            {audience.loadingHolySheet ? 'Loading…' : 'Fetch HolySheet Data'}
          </Button>
          {audience.csvRecipients.length > 0 && (
            <div className="mt-4 space-y-3">
              <CampaignEngagementFilter audience={audience} />
              <div className="flex flex-wrap gap-2">
              {Array.from(new Set(audience.csvRecipients.map((r) => r.source))).map((src) => {
                const count = audience.csvRecipients.filter((r) => r.source === src).length;
                const isActive = !audience.excludedSources.includes(src);
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      if (isActive) audience.setExcludedSources((prev) => [...prev, src]);
                      else audience.setExcludedSources((prev) => prev.filter((s) => s !== src));
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-2 ${
                      isActive
                        ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/30 text-[var(--color-action-primary)]'
                        : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {isActive ? <CheckCircle2 size={12} /> : <span className="w-3 h-3 rounded-full border" />}
                    {src} ({count})
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}

      {audience.audienceSource === 'crm' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <TabSwitcher
              activeTab={audience.crmSegment || 'sales'}
              onChange={(seg) => {
                audience.setCrmSegment?.(seg);
                audience.setLeadStatusFilter?.('all');
                audience.loadCrmContactsData?.(seg);
              }}
              tabs={[
                { id: 'sales', label: 'Sales CRM' },
                { id: 'artist', label: 'Artist CRM' },
              ]}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => audience.loadCrmContactsData(audience.crmSegment)}
              disabled={audience.contactsLoading}
            >
              <RefreshCw size={12} className={audience.contactsLoading ? 'animate-spin' : ''} /> Load CRM
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NexusDropdown
              label="Interest / status"
              placeholder="All statuses"
              options={leadStatusOptions}
              value={audience.leadStatusFilter || 'all'}
              onChange={(v) => audience.setLeadStatusFilter?.(v)}
            />
            <CampaignEngagementFilter audience={audience} inline />
            {audience.crmSegment === 'artist' && (
              <>
                <NexusDropdown
                  label="Project"
                  placeholder="All artists"
                  options={artistProjectOptions}
                  value={audience.artistProjectFilter || 'all'}
                  onChange={(v) => audience.setArtistProjectFilter?.(v)}
                />
                <NexusDropdown
                  label="Category"
                  placeholder="All categories"
                  options={contactCategoryOptions}
                  value={audience.contactCategoryFilter || 'all'}
                  onChange={(v) => audience.setContactCategoryFilter?.(v)}
                />
              </>
            )}
          </div>

          {loadedCount > 0 && (
            <AudienceContactTable
              audience={audience}
              isExlySource={false}
              filteredCount={filteredCount}
              loadedCount={loadedCount}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
            />
          )}
        </div>
      )}

      {audience.audienceSource === 'datahub' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={audience.loadDataHubContactsData}
              disabled={audience.dataHubContactsLoading}
            >
              <RefreshCw size={12} className={audience.dataHubContactsLoading ? 'animate-spin' : ''} /> Load Data Hub
            </Button>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Unified people from Admin Data Hub inlets
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NexusDropdown
              label="Data folder"
              placeholder="All people"
              options={dataHubFolderOptions}
              value={audience.dataHubFolderFilter || 'all'}
              onChange={(v) => audience.setDataHubFolderFilter?.(v)}
              searchable
            />
            <CampaignEngagementFilter audience={audience} inline />
          </div>

          {loadedCount > 0 && (
            <AudienceContactTable
              audience={audience}
              isExlySource={false}
              isDataHubSource
              filteredCount={filteredCount}
              loadedCount={loadedCount}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
            />
          )}
        </div>
      )}

      {audience.audienceSource === 'exly' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={audience.loadExlyContactsData}
              disabled={audience.exlyContactsLoading}
            >
              <RefreshCw size={12} className={audience.exlyContactsLoading ? 'animate-spin' : ''} /> Load Exly
            </Button>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Bookings from Exly Data Hub inlet
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NexusDropdown
              label="Exly offerings"
              placeholder="All offerings"
              options={exlyOfferingOptions}
              value={audience.exlyOfferingIdsFilter || []}
              onChange={(v) => audience.setExlyOfferingIdsFilter?.(v)}
              multi
              searchable
            />
            <NexusDropdown
              label="Interest / status"
              placeholder="All statuses"
              options={leadStatusOptions}
              value={audience.exlyLeadStatusFilter || 'all'}
              onChange={(v) => audience.setExlyLeadStatusFilter?.(v)}
            />
            <CampaignEngagementFilter audience={audience} inline />
          </div>

          {loadedCount > 0 && (
            <AudienceContactTable
              audience={audience}
              isExlySource
              filteredCount={filteredCount}
              loadedCount={loadedCount}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
            />
          )}
        </div>
      )}

      {audience.audienceSource === 'manual' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">Add recipients one at a time (email required).</p>
          <ManualRecipientForm onAdd={(r) => audience.setManualRecipients((prev) => [...prev, r])} />
          {audience.manualRecipients.length > 0 && (
            <>
              <CampaignEngagementFilter audience={audience} />
              <ul className="text-xs space-y-1">
              {audience.displayManualRecipients.map((r, i) => (
                <li key={i} className="flex justify-between items-center py-1 border-b border-[var(--color-bg-border)]">
                  <span>{r.name || r.email}</span>
                  <button type="button" className="text-rose-500 text-[10px]" onClick={() => audience.setManualRecipients((prev) => prev.filter((row) => row.email !== r.email || row.name !== r.name))}>Remove</button>
                </li>
              ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className={`p-4 rounded-xl border ${audience.audienceHealth.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/10'}`}>
        <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertCircle size={14} /> Audience health
        </h4>
        <div className="flex gap-4 text-xs font-medium mb-2">
          <span>Total: {audience.previewRecipients?.length ?? 0}</span>
          <span>Valid: {audience.audienceHealth.validCount}</span>
          <span>Issues: {audience.audienceHealth.issues.length}</span>
        </div>
        {audience.audienceHealth.issues.map((issue, i) => (
          <p key={i} className={`text-xs ${issue.severity === 'error' ? 'text-rose-500' : 'text-amber-600'}`}>{issue.message}</p>
        ))}
      </div>

      {previewRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Preview (first 5 rows)</p>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-bg-border)]">
            <table className="w-full text-xs">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Name</th>
                  <th className="px-3 py-2 text-left font-bold">Email</th>
                  {(audience.availableColumns || []).filter((c) => !['name', 'email'].includes(c)).slice(0, 4).map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-bold capitalize">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-t border-[var(--color-bg-border)]">
                    <td className="px-3 py-2">{row.name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[var(--color-text-muted)]">{row.email}</td>
                    {(audience.availableColumns || []).filter((c) => !['name', 'email'].includes(c)).slice(0, 4).map((col) => (
                      <td key={col} className="px-3 py-2">{row.rowData?.[col] ?? row.rowData?.[col.toLowerCase()] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {templateIndices.length > 0 && (audience.previewRecipients?.length ?? 0) > 0 && (
        <div className="space-y-3 p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Map template variables</h4>
          <div className="space-y-3">
            {templateIndices.map((idx) => {
              const label = dummyValues[idx] || dummyValues[String(idx)] || `Variable {${idx}}`;
              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-sm font-medium min-w-[140px]">{label}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] hidden sm:inline">{`{${idx}}`}</span>
                  <select
                    value={variableMapping[idx] || variableMapping[String(idx)] || ''}
                    onChange={(e) => setMapping(idx, e.target.value)}
                    className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-lg text-sm outline-none"
                  >
                    <option value="">— Select column —</option>
                    {(audience.availableColumns || []).map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignEngagementFilter({ audience, inline = false }) {
  return (
    <NexusDropdown
      label="Campaign engagement"
      placeholder="All engagement"
      options={CAMPAIGN_ENGAGEMENT_FILTER_OPTIONS}
      value={audience.campaignEngagementFilter || 'all'}
      onChange={(v) => audience.setCampaignEngagementFilter?.(v)}
      className={inline ? undefined : 'max-w-sm'}
    />
  );
}

function AudienceContactTable({
  audience,
  isExlySource,
  isDataHubSource = false,
  filteredCount,
  loadedCount,
  selectedIds,
  setSelectedIds,
}) {
  return (
    <>
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search..."
          value={audience.searchTerm}
          onChange={(e) => audience.setSearchTerm(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
          {filteredCount} of {loadedCount} loaded
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            const ids = (audience.displayContacts || []).map((l) => l._id);
            setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
          }}
        >
          Select all
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setSelectedIds([])}
        >
          Deselect all
        </Button>
      </div>
      <DataTable
        columns={[
          {
            header: '',
            render: (row) => {
              const isSel = selectedIds.includes(row._id);
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (isSel) setSelectedIds((prev) => prev.filter((id) => id !== row._id));
                    else setSelectedIds((prev) => [...prev, row._id]);
                  }}
                  className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)]'}`}
                >
                  {isSel && <Check size={10} />}
                </button>
              );
            },
          },
          { header: 'Name', render: (row) => <span className="text-xs font-medium">{row.name || '—'}</span> },
          { header: 'Email', render: (row) => <span className="text-xs font-mono text-[var(--color-text-muted)]">{row.email}</span> },
          {
            header: 'Email status',
            render: (row) => (
              <Badge
                variant={row.emailStatus === 'Active' ? 'mint' : row.emailStatus === 'Invalid' ? 'rose' : 'slate'}
                className="text-[9px]"
              >
                {row.emailStatus || 'Pending'}
              </Badge>
            ),
          },
          ...(isDataHubSource ? [{
            header: 'Inlets',
            render: (row) => (
              <span className="text-[9px] text-[var(--color-text-muted)] truncate max-w-[140px] inline-block">
                {(row.inletLabels || []).join(', ') || '—'}
              </span>
            ),
          }] : []),
          ...(isExlySource ? [{
            header: 'Offering',
            render: (row) => (
              <span className="text-[9px] text-[var(--color-text-muted)]">
                {row.exlyOfferingTitle
                  || row.exlyOfferings?.map((o) => o.title).filter(Boolean).join(', ')
                  || '—'}
              </span>
            ),
          }] : []),
          ...(audience.crmSegment === 'artist' && !isExlySource ? [{
            header: 'Category',
            render: (row) => (
              <Badge variant="slate" className="text-[9px] capitalize">
                {row.contactCategory?.replace(/_/g, ' ') || '—'}
              </Badge>
            ),
          }] : []),
          { header: 'Status', render: (row) => <Badge variant="slate" className="text-[9px]">{row.leadStatus || 'Fresh'}</Badge> },
        ]}
        data={(audience.displayContacts || []).slice(0, 50)}
      />
    </>
  );
}

function ManualRecipientForm({ onAdd }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  return (
    <div className="flex flex-wrap gap-2">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[120px]" />
      <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 min-w-[160px]" />
      <Button
        size="sm"
        type="button"
        onClick={() => {
          if (!email.trim()) return;
          onAdd({ name: name.trim(), email: email.trim().toLowerCase(), rowData: { name: name.trim(), email: email.trim().toLowerCase() } });
          setName('');
          setEmail('');
        }}
      >
        Add
      </Button>
    </div>
  );
}
