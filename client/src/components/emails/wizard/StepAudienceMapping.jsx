import React, { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Upload, RefreshCw, Users, Sheet, UserPlus, AlertCircle, Check, CheckCircle2,
} from 'lucide-react';
import { Button, Input, Badge, DataTable, TabSwitcher } from '../../ui';
const SOURCE_TILES = [
  { id: 'csv', label: 'CSV Upload', icon: Upload },
  { id: 'holysheet', label: 'HolySheet', icon: Sheet },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'manual', label: 'Manual', icon: UserPlus },
];

export default function StepAudienceMapping({
  audience,
  approvedTemplates = [],
  templateIndices = [],
}) {
  const { watch, setValue } = useFormContext();
  const mailTemplateId = watch('mailTemplateId');
  const variableMapping = watch('variableMapping') || {};

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => String(t._id) === String(mailTemplateId)),
    [approvedTemplates, mailTemplateId]
  );

  const previewRows = (audience.previewRecipients || []).slice(0, 5);
  const dummyValues = selectedTemplate?.dummyValues || {};

  const setMapping = (idx, col) => {
    setValue('variableMapping', { ...variableMapping, [idx]: col }, { shouldValidate: true });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SOURCE_TILES.map(({ id, label, icon: Icon }) => (
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
        </div>
      )}

      {audience.audienceSource === 'holysheet' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <Button onClick={audience.fetchHolySheetData} disabled={audience.loadingHolySheet}>
            <RefreshCw size={14} className={audience.loadingHolySheet ? 'animate-spin' : ''} />
            {audience.loadingHolySheet ? 'Loading…' : 'Fetch HolySheet Data'}
          </Button>
          {audience.csvRecipients.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
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
                audience.loadCrmContactsData?.(seg);
              }}
              tabs={[
                { id: 'sales', label: 'Sales CRM' },
                { id: 'artist', label: 'Artist CRM' },
              ]}
            />
            <Button size="sm" variant="secondary" onClick={() => audience.loadCrmContactsData(audience.crmSegment)} disabled={audience.contactsLoading}>
              <RefreshCw size={12} className={audience.contactsLoading ? 'animate-spin' : ''} /> Load CRM
            </Button>
            {audience.crmSegment !== 'artist' && (
              <Button size="sm" variant="secondary" onClick={audience.loadExlyContactsData} disabled={audience.exlyContactsLoading}>
                <RefreshCw size={12} className={audience.exlyContactsLoading ? 'animate-spin' : ''} /> Load Exly
              </Button>
            )}
          </div>
          {audience.crmSegment === 'artist' && (
            <div className="flex flex-wrap gap-2">
              <select
                className="text-xs rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 py-1"
                value={audience.artistProjectFilter || 'all'}
                onChange={(e) => audience.setArtistProjectFilter?.(e.target.value)}
              >
                <option value="all">All artists</option>
                <option value="YUGM">YUGM</option>
                <option value="Harshad Duhita">Harshad Duhita</option>
                <option value="shared">Shared event DB</option>
              </select>
              <select
                className="text-xs rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 py-1"
                value={audience.contactCategoryFilter || 'all'}
                onChange={(e) => audience.setContactCategoryFilter?.(e.target.value)}
              >
                <option value="all">All categories</option>
                <option value="press_media">Press / media</option>
                <option value="event_organizer">Event organizer</option>
                <option value="event_database">Event database</option>
              </select>
            </div>
          )}
          {((audience.allContacts?.length ?? 0) > 0 || (audience.allExlyContacts?.length ?? 0) > 0) && (
            <>
              <div className="flex flex-wrap gap-3 items-center">
                <TabSwitcher
                  activeTab={audience.activeTab}
                  onChange={audience.setActiveTab}
                  tabs={[{ id: 'all', label: 'All' }, { id: 'fresh', label: 'Fresh' }, { id: 'contacted', label: 'In Progress' }]}
                />
                <Input
                  placeholder="Search..."
                  value={audience.searchTerm}
                  onChange={(e) => audience.setSearchTerm(e.target.value)}
                  className="flex-1 min-w-[180px]"
                />
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    const ids = [...audience.filteredContacts, ...audience.filteredExlyContacts].map((l) => l._id);
                    audience.setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...ids])));
                  }}
                >
                  Select filtered
                </Button>
              </div>
              <DataTable
                columns={[
                  {
                    header: '',
                    render: (row) => {
                      const isSel = audience.selectedLeadIds.includes(row._id);
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSel) audience.setSelectedLeadIds((prev) => prev.filter((id) => id !== row._id));
                            else audience.setSelectedLeadIds((prev) => [...prev, row._id]);
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
                  { header: 'Status', render: (row) => <Badge variant="slate" className="text-[9px]">{row.leadStatus || 'Fresh'}</Badge> },
                ]}
                data={[...audience.filteredContacts, ...audience.filteredExlyContacts].slice(0, 50)}
                defaultPageSize={5}
              />
            </>
          )}
        </div>
      )}

      {audience.audienceSource === 'manual' && (
        <div className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">Add recipients one at a time (email required).</p>
          <ManualRecipientForm onAdd={(r) => audience.setManualRecipients((prev) => [...prev, r])} />
          {audience.manualRecipients.length > 0 && (
            <ul className="text-xs space-y-1">
              {audience.manualRecipients.map((r, i) => (
                <li key={i} className="flex justify-between items-center py-1 border-b border-[var(--color-bg-border)]">
                  <span>{r.name || r.email}</span>
                  <button type="button" className="text-rose-500 text-[10px]" onClick={() => audience.setManualRecipients((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                </li>
              ))}
            </ul>
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
