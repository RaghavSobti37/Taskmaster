import {
  Mail, Upload, Play, CheckCircle2, AlertCircle, FileCode, Users, RefreshCw, Send, Check, Search, X, UserMinus, Edit, Save,
} from 'lucide-react';
import { Card, Button, Input, Badge, DataTable, TabSwitcher } from '../ui';
import { formatProfileResetTime } from './MailProfilesPanel';
import { SMTP_PRESETS, getProfileRotationProviders } from '../../utils/smtpPresets';
import { useMailCampaignWizard } from './useMailCampaignWizard';

export default function MailCampaignWizard(props) {
  const w = useMailCampaignWizard(props);

  return (
    <Card className="p-6 space-y-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
      <div className="flex flex-col gap-4 border-b border-[var(--color-bg-border)] pb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
          <Mail size={16} /> Campaign Architect
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { step: 1, label: 'Strategy' },
            { step: 2, label: 'Audience & Mapping' },
            { step: 3, label: 'Pre-flight' },
          ].map(({ step, label }) => {
            const done = w.campaignStep > step;
            const active = w.campaignStep === step;
            return (
              <button
                key={step}
                type="button"
                onClick={() => w.setCampaignStep(step)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${active
                    ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
                    : done
                      ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600'
                      : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                  }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${active ? 'bg-[var(--color-action-primary)] text-white' : done ? 'bg-emerald-500 text-white' : 'bg-[var(--color-bg-primary)]'
                  }`}>
                  {done ? <Check size={12} /> : step}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {w.campaignStep === 1 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Campaign Title" placeholder="e.g. May Product Release" value={w.title} onChange={(e) => w.setTitle(e.target.value)} />
            <Input label="Email Subject Line" placeholder="e.g. Unlocking Next-Gen Capabilities" value={w.subject} onChange={(e) => w.setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Sender Mode</label>
            <select
              value={w.senderMode}
              onChange={(e) => w.setSenderMode(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
            >
              <option value="single">Single profile — one sender, rotates its SMTP providers</option>
              <option value="pool">SMTP pool — round-robin across multiple profiles</option>
              <option value="system_resend">System Resend (API key)</option>
              <option value="system_smtp">System SMTP (env vars)</option>
            </select>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Single profile uses one From identity and rotates providers on that profile. Pool mode alternates between different profiles.
            </p>
          </div>
          {w.senderMode === 'single' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Sender Profile (SMTP)</label>
              {w.profiles.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-amber-500 font-bold">No SMTP Profiles configured. Please configure a profile first.</span>
                  <Button size="sm" onClick={() => w.onOpenProfiles?.()}>Configure Profile</Button>
                </div>
              ) : (
                <>
                  <select
                    value={w.senderProfileId}
                    onChange={(e) => w.setSenderProfileId(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                  >
                    <option value="">-- Select Sender Profile --</option>
                    {w.profiles.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.email}) — {p.usage?.used ?? 0}/{p.usage?.limit ?? 0} today via {SMTP_PRESETS[p.usage?.rotation?.activeProviders?.[0] || getProfileRotationProviders(p)[0]]?.label || 'SMTP'}
                      </option>
                    ))}
                  </select>
                  {w.senderProfileId && (() => {
                    const sp = w.profiles.find((p) => p._id === w.senderProfileId);
                    if (!sp?.usage) return null;
                    const pct = sp.usage.percent || 0;
                    const providers = sp.usage.rotation?.providers || [];
                    return (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                            <span>Combined SMTP usage today</span>
                            <span className={pct >= 80 ? 'text-amber-500 font-bold' : ''}>{sp.usage.used}/{sp.usage.limit}</span>
                          </div>
                          <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-[var(--color-action-primary)]'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[9px] text-[var(--color-text-muted)]">{formatProfileResetTime(sp.usage.resetAt)}</span>
                        </div>
                        {providers.filter((prov) => prov.used > 0).slice(0, 5).map((prov) => (
                          <div key={prov.providerKey} className="flex justify-between text-[9px] text-[var(--color-text-muted)]">
                            <span>{prov.label}</span>
                            <span>{prov.used}/{prov.limit}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
          {w.senderMode === 'pool' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">SMTP Pool (select multiple)</label>
              <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl">
                {w.profiles.map((p) => {
                  const checked = w.senderProfileIds.includes(p._id);
                  const pct = p.usage?.percent || 0;
                  return (
                    <label key={p._id} className="flex items-center gap-3 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          w.setSenderProfileIds((prev) => (checked ? prev.filter((id) => id !== p._id) : [...prev, p._id]));
                        }}
                      />
                      <span className="flex-1">{p.name} ({p.email})</span>
                      <span className={`text-[10px] font-mono ${pct >= 80 ? 'text-amber-500' : 'text-[var(--color-text-muted)]'}`}>
                        {p.usage?.used ?? 0}/{p.usage?.limit ?? 500}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {(w.senderMode === 'system_resend' || w.senderMode === 'system_smtp') && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-600">
              Uses server {w.senderMode === 'system_resend' ? 'RESEND_API_KEY' : 'SMTP_HOST/USER/PASS'} env vars — not tied to a profile.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs pt-2">
            <button
              type="button"
              onClick={() => w.handleIncludeSignatureChange(!w.includeSignature)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                w.includeSignature
                  ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/40 text-[var(--color-action-primary)]'
                  : 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-action-primary)]/30'
              }`}
            >
              {w.includeSignature ? <Check size={12} /> : <Edit size={12} />}
              Signature
            </button>
            <button
              type="button"
              onClick={() => w.handleIncludeUnsubscribeChange(!w.includeUnsubscribe)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                w.includeUnsubscribe
                  ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/40 text-[var(--color-action-primary)]'
                  : 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-action-primary)]/30'
              }`}
            >
              {w.includeUnsubscribe ? <Check size={12} /> : <UserMinus size={12} />}
              Unsubscribe
            </button>
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase tracking-wider hover:border-[var(--color-action-primary)]/30 transition-all">
              <Upload size={12} /> Attachments ({w.attachments.length})
              <input type="file" multiple className="hidden" onChange={w.handleAttachmentUpload} />
            </label>
          </div>
          {w.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {w.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border px-3 py-1.5 rounded-lg text-[11px] font-mono">
                  <span>{att.filename}</span>
                  <button type="button" className="text-rose-500" onClick={() => w.setAttachments((prev) => prev.filter((_, i) => i !== idx))}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3 pt-4 border-t border-[var(--color-bg-border)]">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FileCode size={14} /> Approved Template
            </h4>
            {w.approvedTemplates.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-xl opacity-50">
                <p className="text-xs font-bold mb-2">No approved templates yet.</p>
                <Button size="sm" onClick={() => w.onOpenTemplates?.()}>Open Template Studio</Button>
              </div>
            ) : (
              <>
                <select
                  value={w.selectedTemplateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    w.setSelectedTemplateId(id);
                    const t = w.approvedTemplates.find((x) => String(x._id) === id);
                    if (t?.subject && !w.subject) w.setSubject(t.subject);
                    w.setVariableMapping({});
                  }}
                  className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                >
                  <option value="">— Select template —</option>
                  {w.approvedTemplates.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                {w.selectedTemplate && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Required variables: {w.templateIndices.length ? w.templateIndices.map((i) => `{${i}}`).join(', ') : 'none'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {w.campaignStep === 2 && (
        <div className="space-y-6 animate-in fade-in">
          {w.selectedTemplate && w.templateIndices.length > 0 && (
            <div className="space-y-3 p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
              <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Map {'{n}'} variables to columns
              </h4>
              {w.previewRecipients.length === 0 ? (
                <p className="text-xs text-amber-500">Load audience below before mapping.</p>
              ) : (
                <table className="w-full text-xs border border-[var(--color-bg-border)] rounded-xl overflow-hidden">
                  <thead className="bg-[var(--color-bg-primary)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Variable</th>
                      <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.templateIndices.map((idx) => (
                      <tr key={idx} className="border-t border-[var(--color-bg-border)]">
                        <td className="px-3 py-2 font-mono font-bold">{`{${idx}}`}</td>
                        <td className="px-3 py-2">
                          <select
                            value={w.variableMapping[idx] || w.variableMapping[String(idx)] || ''}
                            onChange={(e) => w.setVariableMapping((prev) => ({ ...prev, [idx]: e.target.value }))}
                            className="w-full px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg outline-none"
                          >
                            <option value="">— Select column —</option>
                            {w.availableColumns.map((col) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          <div className={`p-4 rounded-xl border ${w.audienceHealth.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/10'}`}>
            <h4 className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertCircle size={14} /> Audience Health Check
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase mb-2">
              <div className="p-2 rounded-lg bg-[var(--color-bg-primary)]">Total {w.previewRecipients.length}</div>
              <div className="p-2 rounded-lg bg-[var(--color-bg-primary)]">Valid {w.audienceHealth.validCount}</div>
              <div className="p-2 rounded-lg bg-[var(--color-bg-primary)]">Issues {w.audienceHealth.issues.length}</div>
            </div>
            {w.audienceHealth.issues.length === 0 ? (
              <p className="text-xs text-emerald-600">Ready to proceed — mapping and audience look good.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {w.audienceHealth.issues.map((issue, i) => (
                  <li key={i} className={issue.severity === 'error' ? 'text-rose-500' : 'text-amber-600'}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Users size={14} /> Target Audience ({w.selectedLeadIds.length + w.activeCsvRecipients.length} Selected)
          </h4>
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
              <h4 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                <Users size={14} /> External Data (HolySheet & CSV)
              </h4>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all">
                  <Upload size={12} className="text-[var(--color-action-primary)]" />
                  {w.csvFileName ? 'CSV Loaded' : 'Upload CSV'}
                  <input type="file" accept=".csv" className="hidden" onChange={w.handleCsvUpload} />
                </label>
                <Button size="xs" onClick={w.fetchHolySheetData} disabled={w.loadingHolySheet}>
                  <RefreshCw size={12} className={w.loadingHolySheet ? 'animate-spin' : ''} /> {w.loadingHolySheet ? w.fetchLoadingPhrase : 'Fetch HolySheet'}
                </Button>
                {w.csvRecipients.length > 0 && (
                  <Button size="xs" variant="ghost" onClick={() => { w.setCsvRecipients([]); w.setExcludedSources([]); w.setExcludedEmails([]); w.setCsvFileName(''); }} className="text-rose-500 hover:bg-rose-500/10 ml-2">Clear All</Button>
                )}
              </div>
            </div>

            {w.csvRecipients.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-[var(--color-bg-border)] rounded-xl opacity-50 flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">No External Data Loaded</span>
              </div>
            ) : (
              <div className="space-y-4">
                {w.allHolySheetTabsExcluded && (
                  <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                    <strong>{w.csvRecipients.length} recipients loaded</strong> — all HolySheet tabs are deselected. Select tabs below to include them in this campaign.
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(w.csvRecipients.map((r) => r.source))).map((src) => {
                    const count = w.csvRecipients.filter((r) => r.source === src).length;
                    const isActive = !w.excludedSources.includes(src);
                    return (
                      <div
                        key={src}
                        onClick={() => {
                          if (isActive) w.setExcludedSources((prev) => [...prev, src]);
                          else w.setExcludedSources((prev) => prev.filter((s) => s !== src));
                        }}
                        className={`cursor-pointer px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-2 transition-all ${isActive ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/30 text-[var(--color-action-primary)]' : 'bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] text-[var(--color-text-muted)]'}`}
                      >
                        {isActive ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border border-[var(--color-text-muted)]" />}
                        {src} ({count})
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <Input placeholder="Search Name or Email..." value={w.externalSearch} onChange={(e) => w.setExternalSearch(e.target.value)} icon={Search} className="flex-1" />
                </div>

                <div className="rounded-xl overflow-hidden">
                  <DataTable
                    columns={[
                      {
                        header: 'Sel',
                        render: (row) => {
                          const isExcluded = w.excludedEmails.includes(row.email);
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isExcluded) w.setExcludedEmails((prev) => prev.filter((em) => em !== row.email));
                                else w.setExcludedEmails((prev) => [...prev, row.email]);
                              }}
                              className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${!isExcluded ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}
                            >
                              {!isExcluded && <Check size={12} />}
                            </div>
                          );
                        },
                      },
                      { header: 'Name', key: 'name', render: (row) => <span className="text-xs font-bold">{row.name || '—'}</span> },
                      { header: 'Email', key: 'email', render: (row) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{row.email}</span> },
                      { header: 'Source', render: (row) => <Badge variant="slate" className="text-[9px]">{row.source}</Badge> },
                    ]}
                    data={w.csvRecipients.filter((r) => !w.excludedSources.includes(r.source)).filter((r) => {
                      if (!w.externalSearch) return true;
                      return (r.name?.toLowerCase().includes(w.externalSearch.toLowerCase()) || r.email?.toLowerCase().includes(w.externalSearch.toLowerCase()));
                    })}
                    defaultPageSize={5}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
              <span className="text-xs font-bold uppercase tracking-tight block">CRM Contacts</span>
              <Button size="xs" variant="secondary" onClick={w.loadCrmContactsData} disabled={w.contactsLoading}>
                <RefreshCw size={12} className={w.contactsLoading ? 'animate-spin' : ''} /> {w.contactsLoading ? w.fetchLoadingPhrase : 'Fetch CRM'}
              </Button>
            </div>
            {w.allContacts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                  <TabSwitcher activeTab={w.activeTab} onChange={w.setActiveTab} tabs={[{ id: 'all', label: 'All' }, { id: 'fresh', label: 'Fresh' }, { id: 'contacted', label: 'In Progress' }]} />
                  <div className="flex-1 min-w-[200px]">
                    <Input placeholder="Search Name or Email..." value={w.searchTerm} onChange={(e) => w.setSearchTerm(e.target.value)} icon={Search} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="xs" variant="secondary" onClick={() => {
                      const filteredIds = w.filteredContacts.map((l) => l._id);
                      const newSelected = Array.from(new Set([...w.selectedLeadIds, ...filteredIds]));
                      w.setSelectedLeadIds(newSelected);
                    }}>Select Filtered ({w.filteredContacts.length})</Button>
                    <Button size="xs" variant="ghost" onClick={() => w.setSelectedLeadIds([])} className="text-rose-500 hover:bg-rose-500/10">Clear</Button>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden">
                  <DataTable
                    columns={[
                      {
                        header: 'Sel',
                        render: (row) => {
                          const isSel = w.selectedLeadIds.includes(row._id);
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSel) w.setSelectedLeadIds((prev) => prev.filter((id) => id !== row._id));
                                else w.setSelectedLeadIds((prev) => [...prev, row._id]);
                              }}
                              className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${isSel ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}
                            >
                              {isSel && <Check size={12} />}
                            </div>
                          );
                        },
                      },
                      { header: 'Name', key: 'name', render: (row) => <span className="text-xs font-bold">{row.name || '—'}</span> },
                      { header: 'Email', key: 'email', render: (row) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{row.email}</span> },
                      { header: 'Status', render: (row) => <Badge variant="slate" className="text-[9px]">{row.leadStatus || 'Fresh'}</Badge> },
                    ]}
                    data={w.filteredContacts}
                    defaultPageSize={5}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
              <span className="text-xs font-bold uppercase tracking-tight block">Exly Contacts</span>
              <Button size="xs" variant="secondary" onClick={w.loadExlyContactsData} disabled={w.exlyContactsLoading}>
                <RefreshCw size={12} className={w.exlyContactsLoading ? 'animate-spin' : ''} /> {w.exlyContactsLoading ? w.fetchLoadingPhrase : 'Fetch Exly'}
              </Button>
            </div>
            {w.allExlyContacts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                  <select
                    value={w.filters.exlyOffering}
                    onChange={(e) => w.setFilters((prev) => ({ ...prev, exlyOffering: e.target.value }))}
                    className="px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-xs font-bold outline-none text-[var(--color-text-primary)]"
                  >
                    <option value="all">All Exly Offerings</option>
                    {w.exlyOfferingsList.map((offering) => (
                      <option key={offering} value={offering}>{offering}</option>
                    ))}
                  </select>
                  <div className="flex-1 min-w-[200px]">
                    <Input placeholder="Search Name or Email..." value={w.searchTerm} onChange={(e) => w.setSearchTerm(e.target.value)} icon={Search} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="xs" variant="secondary" onClick={() => {
                      const filteredIds = w.filteredExlyContacts.map((l) => l._id);
                      const newSelected = Array.from(new Set([...w.selectedLeadIds, ...filteredIds]));
                      w.setSelectedLeadIds(newSelected);
                    }}>Select Filtered ({w.filteredExlyContacts.length})</Button>
                    <Button size="xs" variant="ghost" onClick={() => w.setSelectedLeadIds([])} className="text-rose-500 hover:bg-rose-500/10">Clear</Button>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden">
                  <DataTable
                    columns={[
                      {
                        header: 'Sel',
                        render: (row) => {
                          const isSel = w.selectedLeadIds.includes(row._id);
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSel) w.setSelectedLeadIds((prev) => prev.filter((id) => id !== row._id));
                                else w.setSelectedLeadIds((prev) => [...prev, row._id]);
                              }}
                              className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${isSel ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}
                            >
                              {isSel && <Check size={12} />}
                            </div>
                          );
                        },
                      },
                      { header: 'Name', key: 'name', render: (row) => <span className="text-xs font-bold">{row.name || '—'}</span> },
                      { header: 'Email', key: 'email', render: (row) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{row.email}</span> },
                      { header: 'Status', render: (row) => <Badge variant="slate" className="text-[9px]">{row.leadStatus || 'Fresh'}</Badge> },
                      {
                        header: 'Exly Offering', render: (row) => {
                          let offerings = '';
                          if (Array.isArray(row.exlyOfferings)) {
                            offerings = row.exlyOfferings
                              .map((o) => (typeof o === 'string' ? o : o?.title || o?.offeringId || 'Unknown'))
                              .filter(Boolean)
                              .join(', ');
                          } else {
                            offerings = row.exlyOfferingTitle || '';
                          }
                          return offerings ? <Badge variant="info" className="text-[9px]">{offerings}</Badge> : <span className="text-[10px] text-[var(--color-text-muted)]">—</span>;
                        },
                      },
                    ]}
                    data={w.filteredExlyContacts}
                    defaultPageSize={5}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {w.campaignStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <CheckCircle2 size={14} /> Review
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Title</span>
                {w.title || '—'}
              </div>
              <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Subject</span>
                {w.subject || '—'}
              </div>
              <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Valid recipients</span>
                {w.audienceHealth.validCount}
              </div>
              <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Template</span>
                {w.selectedTemplate?.name || '—'}
              </div>
            </div>
            {!w.audienceHealth.ok && (
              <p className="text-xs text-rose-500">Fix health check issues before sending.</p>
            )}
            {w.templateIndices.length > 0 && (
              <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl border text-[10px] font-mono space-y-1">
                {w.templateIndices.map((idx) => (
                  <div key={idx}>{`{${idx}}`} → {w.variableMapping[idx] || '—'}</div>
                ))}
              </div>
            )}
            <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl space-y-2">
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Test send</label>
              <div className="flex gap-2">
                <Input type="email" placeholder="Test email" value={w.testCampaignEmail} onChange={(e) => w.setTestCampaignEmail(e.target.value)} className="flex-1" />
                <Button size="md" variant="secondary" onClick={w.handleSendTest}>
                  <Send size={12} /> Send Test
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Inbox preview (server-rendered)</p>
              {w.previewRecipients.length > 1 && (
                <div className="flex gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={w.previewRecipientIndex <= 0}
                    onClick={() => w.setPreviewRecipientIndex((i) => Math.max(0, i - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-[10px] font-mono self-center">
                    {w.previewRecipientIndex + 1} / {w.previewRecipients.length}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={w.previewRecipientIndex >= w.previewRecipients.length - 1}
                    onClick={() => w.setPreviewRecipientIndex((i) => Math.min(w.previewRecipients.length - 1, i + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">
              {w.activePreviewRecipient?.email || 'Select audience'}
            </p>
            <div className="bg-white rounded-lg border overflow-hidden relative" style={{ height: '420px' }}>
              {w.previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-xs font-bold z-10">
                  Rendering…
                </div>
              )}
              <iframe
                srcDoc={w.emailPreviewSrcDoc || '<p style="padding:16px">Select template and audience</p>'}
                className="w-full h-full border-none"
                title="Campaign preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-[var(--color-bg-border)]">
        <Button variant="ghost" onClick={w.handleCancelOrBack}>
          {w.campaignStep === 1 ? 'Cancel' : 'Back'}
        </Button>

        {w.campaignStep < 3 ? (
          <Button onClick={w.handleNextStep}>
            Next Step
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => w.handleCreateCampaign('save_draft')}
              disabled={w.createCampaignMutation.isPending || !w.audienceHealth.ok}
            >
              <Save size={14} /> Save Draft
            </Button>
            <Button
              onClick={() => w.handleCreateCampaign('dispatch')}
              disabled={w.createCampaignMutation.isPending || !w.audienceHealth.ok}
            >
              <Play size={14} /> Dispatch Now
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
