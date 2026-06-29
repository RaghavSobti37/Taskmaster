import React, { useState, useMemo } from 'react';
import { formatDisplayDateTime } from '../../utils/dateDisplay';
import {
  User, Mail, Phone, MapPin, Star, Clock, ShoppingBag, Database,
  MessageSquare, Activity, GitCommit, Copy, Check,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, FullScreenWorkspace, Spinner } from '../ui';
import { useDataHubPerson, useDataHubPersonSection } from '../../hooks/useTaskmasterQueries';
import { dedupeInletEntries } from '../../utils/dataHubInlets';
import ArtistPathAnswerSections from '../artistPath/ArtistPathAnswerSections';
import { displayStageBadge } from '../../utils/artistPathDisplay';

const INLET_COLORS = {
  exly: 'info',
  leads: 'mint',
  outsourced: 'neutral',
  newsletter: 'info',
  tsc: 'neutral',
  booked_calls: 'warning',
  enquiries: 'rose',
  mail: 'info',
  community: 'success',
  unsubscribed: 'rose',
  active: 'mint',
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'crm', label: 'CRM' },
  { id: 'exly', label: 'Exly' },
  { id: 'outsourced', label: 'Outsourced' },
  { id: 'artist_path', label: 'Artist Path' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'booked', label: 'Booked Calls' },
  { id: 'enquiries', label: 'Enquiries' },
  { id: 'mail', label: 'Mail' },
  { id: 'timeline', label: 'Timeline' },
];

function formatDate(d) {
  if (!d) return '—';
  try { return formatDisplayDateTime(d); } catch { return String(d); }
}

const INLET_LABELS = {
  exly: 'Exly',
  leads: 'Leads',
  outsourced: 'Outsourced Data',
  newsletter: 'Newsletter',
  artist_path: 'Artist Path',
  tsc: 'Outsourced Data',
  booked_calls: 'Booked Calls',
  enquiries: 'Enquiries',
  mail: 'Mail',
  community: 'Community',
};

const SUMMARY_FIELDS = {
  leads: [
    { key: 'source', label: 'Source' },
    { key: 'leadStatus', label: 'Status' },
    { key: 'callStatus', label: 'Call status' },
  ],
  booked_calls: [
    { key: 'source', label: 'Source' },
    { key: 'course', label: 'Course' },
    { key: 'nextFollowupDate', label: 'Follow-up date' },
    { key: 'nextFollowupTime', label: 'Follow-up time' },
    { key: 'leadStatus', label: 'Status' },
    { key: 'callStatus', label: 'Call status' },
  ],
  outsourced: [
    { key: 'campaign', label: 'Campaign' },
    { key: 'originSource', label: 'Origin' },
    { key: 'role', label: 'Role' },
  ],
  tsc: [
    { key: 'campaign', label: 'Campaign' },
    { key: 'originSource', label: 'Origin' },
    { key: 'role', label: 'Role' },
  ],
  exly: [
    { key: 'offeringTitle', label: 'Offering' },
    { key: 'pricePaid', label: 'Paid', format: 'currency' },
  ],
  community: [
    { key: 'offeringTitle', label: 'Offering' },
    { key: 'campaign', label: 'Campaign' },
    { key: 'originSource', label: 'Origin' },
  ],
  mail: [
    { key: 'mailEventCount', label: 'Mail events' },
  ],
  enquiries: [
    { key: 'artist', label: 'Artist' },
    { key: 'company', label: 'Company' },
    { key: 'collaborationType', label: 'Collaboration' },
  ],
};

function formatSummaryValue(value, format) {
  if (value == null || value === '') return null;
  if (format === 'currency') return `₹${Number(value).toLocaleString('en-IN')}`;
  return String(value);
}

function InletSummary({ inletKey, summary }) {
  if (!summary || !Object.keys(summary).length) return null;

  const fields = SUMMARY_FIELDS[inletKey];
  const rows = fields
    ? fields
      .map(({ key, label, format }) => {
        const val = formatSummaryValue(summary[key], format);
        return val ? { label, value: val } : null;
      })
      .filter(Boolean)
    : Object.entries(summary)
      .filter(([, v]) => v != null && v !== '')
      .map(([key, val]) => ({
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        value: formatSummaryValue(val),
      }));

  if (!rows.length) return null;

  return (
    <dl className="mt-2 space-y-1 border-t border-[var(--color-bg-border)] pt-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[minmax(0,38%)_1fr] gap-x-2 gap-y-0.5 text-[11px]">
          <dt className="text-[var(--color-text-muted)] font-semibold uppercase tracking-wide text-[9px]">{label}</dt>
          <dd className="text-[var(--color-text-primary)] font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyableField({ icon: Icon, value, label }) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);
  const text = value && value !== '—' ? String(value) : '';

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex items-center gap-2 group">
      <Icon size={14} className="shrink-0 text-[var(--color-text-muted)]" />
      <span className="truncate flex-1">{text || '—'}</span>
      {text && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      )}
    </div>
  );
}

function QuickStatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-bg-border)] last:border-0">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className={`text-sm font-black tabular-nums ${highlight ? 'text-[var(--color-action-primary)]' : ''}`}>{value}</span>
    </div>
  );
}

export default function DataHubPersonDetail({ contactId, onClose }) {
  const [tab, setTab] = useState('overview');
  const { data: base, isLoading: baseLoading } = useDataHubPerson(contactId);
  const { data: sectionData, isLoading: sectionLoading } = useDataHubPersonSection(contactId, tab);

  const person = useMemo(() => {
    if (!base) return null;
    return {
      contact: base.contact,
      overview: { ...base.overview, ...(sectionData?.overview || {}) },
      crm: sectionData?.crm,
      exly: sectionData?.exly,
      outsourced: sectionData?.outsourced || sectionData?.tsc,
      newsletter: sectionData?.newsletter,
      bookedCalls: sectionData?.bookedCalls,
      enquiries: sectionData?.enquiries,
      mail: sectionData?.mail,
      artistPath: sectionData?.artistPath,
      timeline: sectionData?.timeline,
    };
  }, [base, sectionData]);

  const overview = person?.overview || base?.overview;
  const contact = person?.contact || base?.contact;
  const loading = baseLoading || sectionLoading;

  if (!contactId) return null;

  return (
    <FullScreenWorkspace
      isOpen={!!contactId}
      onClose={onClose}
      title={contact?.name || 'Person Detail'}
      subtitle={contact?.email || contact?.phone || ''}
      sidebar={
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Identity</h4>
            <div className="space-y-2 text-sm">
              <CopyableField icon={User} value={contact?.name} label="Name" />
              <CopyableField icon={Mail} value={contact?.email} label="Email" />
              <CopyableField icon={Phone} value={contact?.phone} label="Phone" />
              <CopyableField icon={MapPin} value={contact?.city} label="City" />
              {contact?._id && (
                <CopyableField icon={Database} value={contact._id} label="Contact ID" />
              )}
            </div>
          </Card>
          <Card className="p-4 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Inlets</h4>
            <div className="flex flex-wrap gap-1">
              {dedupeInletEntries(contact?.inlets || []).map((inlet) => (
                <Badge key={inlet.key} variant={INLET_COLORS[inlet.key] || 'neutral'}>
                  {INLET_LABELS[inlet.key] || inlet.key}
                </Badge>
              ))}
            </div>
            {overview?.isMultiInlet && (
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold mt-2">
                <Star size={12} /> Loyal customer ({overview.inletCount} inlets)
              </div>
            )}
          </Card>
          <Card className="p-4 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Email status</span><Badge variant={contact?.emailStatus === 'Active' ? 'mint' : 'neutral'}>{contact?.emailStatus}</Badge></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">First seen</span><span>{formatDate(overview?.firstSeen)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Last activity</span><span>{formatDate(overview?.lastSeen)}</span></div>
            {overview?.exlyRevenue > 0 && (
              <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Exly revenue</span><span>₹{overview.exlyRevenue.toLocaleString()}</span></div>
            )}
          </Card>
        </div>
      }
    >
      {loading && (
        <div className="p-4 flex justify-center">
          <Spinner size="md" />
        </div>
      )}

      {!loading && person && (
        <>
          <div className="flex gap-1 flex-wrap border-b border-[var(--color-bg-border)] mb-4 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-selected={tab === t.id}
                role="tab"
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                  tab === t.id
                    ? 'bg-[var(--color-action-primary)] text-white'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="text-[10px] font-black uppercase mb-3">Data Inlets</h4>
                <div className="space-y-3">
                  {dedupeInletEntries(contact.inlets || []).map((inlet) => (
                    <div key={inlet.key} className="p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant={INLET_COLORS[inlet.key] || 'neutral'}>
                          {INLET_LABELS[inlet.key] || inlet.key}
                        </Badge>
                        <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase">
                          {inlet.recordIds?.length || 0} record{(inlet.recordIds?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                        <Clock size={10} /> Last activity · {formatDate(inlet.lastSeenAt)}
                      </p>
                      <InletSummary inletKey={inlet.key} summary={inlet.summary} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <h4 className="text-[10px] font-black uppercase mb-3">Quick Stats</h4>
                <div>
                  <QuickStatRow label="CRM leads" value={overview?.crmLeadCount ?? person.crm?.leads?.length ?? 0} highlight={!!(overview?.crmLeadCount || person.crm?.leads?.length)} />
                  <QuickStatRow label="Exly bookings" value={overview?.exlyBookingCount ?? person.exly?.bookings?.length ?? 0} highlight={!!(overview?.exlyBookingCount || person.exly?.bookings?.length)} />
                  <QuickStatRow label="Outsourced rows" value={person.outsourced?.rows?.length || 0} />
                  <QuickStatRow label="Newsletter" value={person.newsletter?.rows?.length || 0} />
                  <QuickStatRow label="Enquiries" value={person.enquiries?.length || 0} />
                  <QuickStatRow label="Mail events" value={person.mail?.events?.length || 0} />
                  <QuickStatRow label="Booked calls" value={person.bookedCalls?.leads?.length || 0} />
                  {overview?.exlyRevenue > 0 && (
                    <QuickStatRow label="Exly revenue" value={`₹${overview.exlyRevenue.toLocaleString('en-IN')}`} highlight />
                  )}
                </div>
              </Card>
            </div>
          )}

          {tab === 'crm' && (
            <div className="space-y-4">
              {(person.crm?.leads || []).map((lead) => (
                <Card key={lead._id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="mint">{lead.leadStatus}</Badge>
                    <Badge variant="neutral">{lead.callStatus}</Badge>
                    <Badge variant="info">Q{lead.leadQuality}</Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">Source: {lead.source}</span>
                  </div>
                  <p className="text-sm">{lead.remarks || 'No remarks'}</p>
                  {lead.notes?.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {lead.notes.map((n, i) => (
                        <div key={i} className="text-xs p-2 bg-[var(--color-bg-secondary)] rounded">
                          <span className="font-bold">{n.author}</span>: {n.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {person.crm?.emis?.filter((e) => String(e.leadId) === String(lead._id)).length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-[9px] font-black uppercase text-[var(--color-text-muted)] mb-1">EMIs</h5>
                      {person.crm.emis.filter((e) => String(e.leadId) === String(lead._id)).map((emi) => (
                        <div key={emi._id} className="text-xs">#{emi.installmentNo} — ₹{emi.amount} — {emi.status}</div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
              {(person.crm?.audits || []).length > 0 && (
                <Card className="p-4">
                  <h4 className="text-[10px] font-black uppercase mb-2">Audit Trail</h4>
                  {person.crm.audits.map((a) => (
                    <div key={a._id} className="text-xs py-1 border-b border-[var(--color-bg-border)] last:border-0">
                      {formatDate(a.timestamp)} — {a.fieldChanged}: {a.oldValue} → {a.newValue}
                    </div>
                  ))}
                </Card>
              )}
              {!person.crm?.leads?.length && <p className="text-sm text-[var(--color-text-muted)]">No CRM data</p>}
            </div>
          )}

          {tab === 'exly' && (
            <div className="space-y-3">
              {(person.exly?.bookings || []).map((b) => (
                <Card key={b._id} className="p-4 flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm">{b.offeringTitle}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(b.bookedOn)}</p>
                    <p className="text-xs">Txn: {b.transactionId || '—'}</p>
                  </div>
                  <Badge variant="success">₹{Number(b.pricePaid || 0).toLocaleString()}</Badge>
                </Card>
              ))}
              {!person.exly?.bookings?.length && <p className="text-sm text-[var(--color-text-muted)]">No Exly bookings</p>}
            </div>
          )}

          {tab === 'outsourced' && (
            <div className="space-y-3">
              {(person.outsourced?.rows || []).map((row) => (
                <Card key={row._id} className="p-4 space-y-1">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="info">{row.campaign || 'No campaign'}</Badge>
                    <Badge variant="neutral">{row.originSource || '—'}</Badge>
                    {row.role && <Badge variant="mint">{row.role}</Badge>}
                  </div>
                  <p className="text-xs">{row.city}{row.state ? `, ${row.state}` : ''}</p>
                  {row.tags?.length > 0 && <p className="text-xs">Tags: {row.tags.join(', ')}</p>}
                </Card>
              ))}
              {!person.outsourced?.rows?.length && <p className="text-sm text-[var(--color-text-muted)]">No outsourced records</p>}
            </div>
          )}

          {tab === 'newsletter' && (
            <div className="space-y-3">
              {(person.newsletter?.rows || []).map((row) => (
                <Card key={row._id} className="p-4 space-y-1">
                  <Badge variant="info">{row.source || 'Newsletter'}</Badge>
                  <p className="text-xs text-[var(--color-text-muted)]">Subscribed: {formatDate(row.subscribedAt)}</p>
                  <p className="text-xs">Status: {row.emailStatus || '—'}</p>
                </Card>
              ))}
              {!person.newsletter?.rows?.length && <p className="text-sm text-[var(--color-text-muted)]">No newsletter subscriptions</p>}
            </div>
          )}

          {tab === 'artist_path' && (
            <div className="space-y-4">
              {(person.artistPath?.responses || []).map((resp) => (
                <Card key={resp._id} className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[var(--color-bg-border)] pb-3">
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDate(resp.submittedAt)}</span>
                    {displayStageBadge({ stageName: resp.answers?.stageName, latestArtistType: resp.answers?.artistType }) && (
                      <Badge variant="mint">{resp.answers.stageName || resp.answers.artistType}</Badge>
                    )}
                  </div>
                  <ArtistPathAnswerSections answers={resp.answers} />
                </Card>
              ))}
              {!person.artistPath?.responses?.length && (
                <p className="text-sm text-[var(--color-text-muted)]">No Artist Path responses</p>
              )}
            </div>
          )}

          {tab === 'booked' && (
            <div className="space-y-3">
              {(person.bookedCalls?.calls || []).map((row) => (
                <Card key={row._id} className="p-4">
                  <Badge variant="warning">Booked Call</Badge>
                  <p className="text-sm mt-2">{row.source || 'Call booking'}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(row.bookedAt)} · {row.callStatus || '—'}</p>
                </Card>
              ))}
              {(person.bookedCalls?.leads || []).map((lead) => (
                <Card key={lead._id} className="p-4">
                  <Badge variant="warning">CRM Booked Call</Badge>
                  <p className="text-sm mt-2">Follow-up: {lead.nextFollowupDate} {lead.nextFollowupTime}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Status: {lead.callStatus} · {lead.leadStatus}</p>
                </Card>
              ))}
              {!person.bookedCalls?.leads?.length && !person.bookedCalls?.calls?.length && (
                <p className="text-sm text-[var(--color-text-muted)]">No booked calls</p>
              )}
            </div>
          )}

          {tab === 'enquiries' && (
            <div className="space-y-3">
              {(person.enquiries || []).map((t) => (
                <Card key={t._id} className="p-4 space-y-2">
                  <p className="font-bold text-sm">{t.title}</p>
                  {t.parsed && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(t.parsed).map(([k, v]) => v && v !== '—' && (
                        <div key={k}>
                          <span className="text-[var(--color-text-muted)] uppercase text-[9px] font-semibold tracking-wide">
                            {k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                          </span>
                          <p className="mt-0.5">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
              {!person.enquiries?.length && <p className="text-sm text-[var(--color-text-muted)]">No enquiries</p>}
            </div>
          )}

          {tab === 'mail' && (
            <div className="space-y-2">
              {(person.mail?.events || []).map((evt) => (
                <div key={evt._id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-bg-secondary)] text-xs">
                  <Mail size={12} />
                  <Badge variant={evt.eventType === 'Open' ? 'mint' : evt.eventType === 'Click' ? 'info' : 'neutral'}>{evt.eventType}</Badge>
                  <span className="flex-1 truncate">{evt.campaignName || evt.campaignId || 'Campaign'}</span>
                  <span className="text-[var(--color-text-muted)]">{formatDate(evt.timestamp || evt.createdAt)}</span>
                </div>
              ))}
              {!person.mail?.events?.length && <p className="text-sm text-[var(--color-text-muted)]">No mail events</p>}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-2">
              {(person.timeline || []).map((evt, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg border border-[var(--color-bg-border)]">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center shrink-0">
                    {evt.type === 'mail' && <Mail size={12} />}
                    {evt.type === 'exly' && <ShoppingBag size={12} />}
                    {evt.type === 'lead' && <Database size={12} />}
                    {(evt.type === 'tsc' || evt.type === 'outsourced') && <Activity size={12} />}
                    {evt.type === 'enquiry' && <MessageSquare size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{evt.label}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{formatDate(evt.date)}</p>
                  </div>
                  <Badge variant="neutral">{evt.type}</Badge>
                </div>
              ))}
              {!person.timeline?.length && <p className="text-sm text-[var(--color-text-muted)]">No timeline events</p>}
            </div>
          )}
        </>
      )}
    </FullScreenWorkspace>
  );
}
