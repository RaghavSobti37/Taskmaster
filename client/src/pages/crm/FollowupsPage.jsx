import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, RefreshCw, Clock, Target, CheckCircle2, AlertCircle, PhoneCall, Calendar, Edit2, Users, Layers, GitCommit, Briefcase, Bell, UserCheck, MapPin, Globe, MessageSquare, Send, History
} from 'lucide-react';
import { 
  Badge, 
  Card, 
  DataTable, 
  Button, 
  Input, 
  TabSwitcher,
  PageSkeleton,
  FullScreenWorkspace,
  ListPageLayout,
  UserLabel,
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useLiveLeads, useSalesReps, useUpdateLead, useCRMConfig } from '../../hooks/useTaskmasterQueries';
import { format, isPast, isToday, isValid } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { validateLeadFormFields } from '../../utils/leadFormValidation';
import { buildLeadEditState, leadEditHasChanges } from '../../utils/leadEditState';
import PhoneNumberFields from '../../components/crm/PhoneNumberFields';
const FOLLOWUP_PAGE_SIZE = 50;

export default function FollowupsPage() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('today');
  const [followupPage, setFollowupPage] = useState(1);
  const [sortField, setSortField] = useState('nextFollowupDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedLead, setSelectedLead] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [leadLogs, setLeadLogs] = useState([]);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useLiveLeads({
    page: followupPage,
    limit: FOLLOWUP_PAGE_SIZE,
    sort: sortField,
    order: sortOrder,
    hasFollowup: 'true',
    followupTab: activeTab,
    assignedRepId: isAdminUser(user) ? undefined : user?._id
  });

  const leads = data?.leads || [];
  const followupPages = data?.pages || 1;
  const { data: team = [] } = useSalesReps();
  const { data: crmConfig } = useCRMConfig();

  const leadStatusesList = crmConfig?.leadStatuses || ['New', 'Contacted', 'Warm', 'Hot', 'Qualified', 'Proposal', 'Converted', 'Lost'];
  const callStatusesList = crmConfig?.callStatuses || ['Pending', 'Connected', 'Busy', 'DNP', 'Switched Off'];
  const qualitiesList = crmConfig?.qualities || ['1', '2', '3', '4', '5', 'Future 4'];

  const updateMutation = useUpdateLead();

  useEffect(() => {
    setFollowupPage(1);
  }, [activeTab, sortField, sortOrder]);

  const isDefaultSort = sortField === 'nextFollowupDate' && sortOrder === 'asc';
  const tableSortState = useMemo(
    () => (isDefaultSort ? null : { key: sortField, direction: sortOrder }),
    [sortField, sortOrder, isDefaultSort]
  );

  const handleTableSortChange = (next) => {
    if (!next) {
      setSortField('nextFollowupDate');
      setSortOrder('asc');
    } else {
      setSortField(next.key);
      setSortOrder(next.direction);
    }
    setFollowupPage(1);
  };

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId || !leads.length) return;
    const match = leads.find((l) => l._id === highlightId);
    if (match) setSelectedLead(match);
  }, [searchParams, leads]);
  const [editLeadData, setEditLeadData] = useState({
    name: '', phoneCountryCode: '+91', phoneNational: '', city: '', leadQuality: '3', leadStatus: 'New', callStatus: 'Pending', remarks: '', nextFollowupDate: '', nextFollowupTime: '', setReminder: false, planOption: '', assignedRepId: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editBaseline, setEditBaseline] = useState(null);

  const applyLeadValidation = (data) => {
    const { errors } = validateLeadFormFields(data);
    setFieldErrors(errors);
  };

  const patchEditLeadData = (patch) => {
    setEditLeadData((prev) => {
      const next = { ...prev, ...patch };
      applyLeadValidation(next);
      return next;
    });
  };

  React.useEffect(() => {
    if (selectedLead) {
      const loaded = buildLeadEditState(selectedLead);
      setEditLeadData(loaded);
      setEditBaseline(loaded);
      applyLeadValidation(loaded);

      // Fetch audit trail for the selected lead
      axios.get(`/api/crm/leads/${selectedLead._id}/audit`)
        .then(res => setLeadLogs(res.data))
        .catch(err => console.error('Failed to fetch lead logs', err));
    } else {
      setLeadLogs([]);
      setFieldErrors({});
      setEditBaseline(null);
    }
  }, [selectedLead]);

  const hasLeadChanges = leadEditHasChanges(editLeadData, editBaseline);
  const handleRevertLeadEdits = () => {
    if (editBaseline) {
      setEditLeadData(editBaseline);
      applyLeadValidation(editBaseline);
    }
  };

  const handleSaveLead = async () => {
    if (!selectedLead || updateMutation.isPending) return;
    const { valid, errors, sanitized } = validateLeadFormFields(editLeadData);
    setFieldErrors(errors);
    if (!valid) {
      toast.error(errors.phone || Object.values(errors)[0] || 'Fix highlighted fields before saving');
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync({
        id: selectedLead._id,
        data: sanitized,
      });
      setSelectedLead(updated);
      toast.success('Lead saved');
      axios.get(`/api/crm/leads/${selectedLead._id}/audit`)
        .then(res => setLeadLogs(res.data))
        .catch(err => console.error('Failed to fetch lead logs', err));
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save lead');
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedLead) return;
    setAddingNote(true);
    try {
      const res = await axios.post(`/api/crm/leads/${selectedLead._id}/notes`, { text: newNoteText });
      setSelectedLead(res.data);
      setNewNoteText('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      // Fetch updated audit trail
      axios.get(`/api/crm/leads/${selectedLead._id}/audit`)
        .then(r => setLeadLogs(r.data))
        .catch(err => console.error('Failed to fetch lead logs', err));
    } catch (err) {
      alert('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const parseFollowupDate = (dateStr, timeStr) => {
    if (!dateStr) return null;
    try {
      const baseDate = new Date(dateStr);
      if (!isValid(baseDate)) return null;
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        baseDate.setHours(hours || 0, minutes || 0, 0, 0);
      }
      return baseDate;
    } catch (e) {
      return null;
    }
  };

  const processedLeads = useMemo(() => {
    return leads.map(lead => ({
      ...lead,
      followupFullDate: parseFollowupDate(lead.nextFollowupDate, lead.nextFollowupTime)
    })).filter(l => l.followupFullDate !== null);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return [...processedLeads].sort((a, b) => a.followupFullDate - b.followupFullDate);
  }, [processedLeads]);

  const stats = useMemo(() => {
    if (data?.tabStats) {
      return {
        today: data.tabStats.today || 0,
        overdue: data.tabStats.overdue || 0,
        upcoming: data.tabStats.upcoming || 0,
      };
    }
    return { today: 0, overdue: 0, upcoming: 0 };
  }, [data?.tabStats]);

  const columns = [
    {
      header: 'Done',
      render: (row) => (
        <input
          type="checkbox"
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          checked={false}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            e.stopPropagation();
            const ok = await confirm({
              title: 'Complete follow-up?',
              message: `Mark follow-up completed for ${row?.name}?`,
              confirmLabel: 'Complete',
              type: 'success',
            });
            if (!ok) return;
            try {
                await updateMutation.mutateAsync({
                  id: row._id,
                  data: {
                    callStatus: 'Connected',
                    nextFollowupDate: '',
                    nextFollowupTime: '',
                    remarks: (row.remarks ? row.remarks + '\n' : '') + `[Follow-up done on ${format(new Date(), 'dd-MM-yyyy')}]`
                  }
                });
                queryClient.invalidateQueries({ queryKey: ['leads'] });
                queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
              } catch (err) {
                alert(err.response?.data?.error || err.message);
              }
          }}
        />
      )
    },
    {
      header: 'Customer Details',
      sortKey: 'name',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs tracking-tight">{row?.name}</span>
            {row.source && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold tracking-tight">
                {row?.source}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{row?.phone} {row?.email ? `• ${row?.email}` : ''}</span>
        </div>
      )
    },
    {
      header: 'Planned Time',
      sortKey: 'nextFollowupDate',
      sortFn: (row) => row.followupFullDate,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isPast(row.followupFullDate) && !isToday(row.followupFullDate) ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
            <Clock size={12} />
          </div>
          <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase ${isPast(row.followupFullDate) && !isToday(row.followupFullDate) ? 'text-rose-600' : ''}`}>
              {format(row.followupFullDate, 'h:mm a')}
            </span>
            <span className="text-[8px] text-[var(--color-text-muted)] font-bold uppercase">
              {isToday(row.followupFullDate) ? 'Today' : format(row.followupFullDate, 'MMM dd')}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Interest Level',
      sortKey: 'leadStatus',
      render: (row) => (
        <Badge variant={row.leadStatus === 'Hot' ? 'danger' : row.leadStatus === 'Warm' ? 'warning' : 'info'}>
          {row?.leadStatus}
        </Badge>
      )
    },
    {
      header: 'Assigned Agent',
      render: (row) => (
        <UserLabel
          user={row.assignedRep}
          name={row.assignedRep?.name || 'Unassigned'}
          size="xs"
          nameClassName="text-[10px] font-black uppercase tracking-tight truncate"
        />
      )
    }
  ];

  if (isLoading && leads.length === 0) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'today',
            label: 'Calls Today',
            value: stats.today,
            icon: PhoneCall,
            variant: 'info',
            info: 'Interactions planned for the current day.',
            onClick: () => setActiveTab('today'),
            active: activeTab === 'today',
          },
          {
            id: 'overdue',
            label: 'Overdue Tasks',
            value: stats.overdue,
            icon: AlertCircle,
            variant: 'rose',
            info: 'Scheduled calls that were missed.',
            onClick: () => setActiveTab('overdue'),
            active: activeTab === 'overdue',
          },
          {
            id: 'upcoming',
            label: 'Next Commitments',
            value: stats.upcoming,
            icon: Calendar,
            variant: 'mint',
            info: 'Future interactions scheduled in your pipeline.',
            onClick: () => setActiveTab('upcoming'),
            active: activeTab === 'upcoming',
          },
          {
            id: 'goal',
            label: 'Daily Goal',
            value: '100%',
            icon: CheckCircle2,
            variant: 'slate',
            info: "The percentage of today's calls you have finished.",
          },
        ],
        charts: [
          {
            id: 'queue',
            title: 'Follow-up queue',
            type: 'donut',
            data: [
              { label: 'Today', value: stats.today },
              { label: 'Overdue', value: stats.overdue },
              { label: 'Upcoming', value: stats.upcoming },
            ],
          },
        ],
      }}
      toolbar={
        <TabSwitcher
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'today', label: `Today (${stats.today})` },
            { id: 'overdue', label: `Overdue (${stats.overdue})` },
            { id: 'upcoming', label: `Upcoming (${stats.upcoming})` },
          ]}
        />
      }
      toolbarActions={
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </Button>
      }
    >
      <Card className="p-0 overflow-hidden border border-[var(--color-bg-border)]">
        <DataTable
          columns={columns}
          data={filteredLeads}
          getRowId={(row) => row._id}
          onRowClick={(row) => setSelectedLead(row)}
          serverSide
          paginated
          currentPage={followupPage}
          totalPages={followupPages}
          totalItems={data?.total || 0}
          pageSize={FOLLOWUP_PAGE_SIZE}
          onPageChange={setFollowupPage}
          sortState={tableSortState}
          onSortChange={handleTableSortChange}
          isLoading={isLoading}
        />
      </Card>

      <FullScreenWorkspace
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.name || 'Customer Details'}
        subtitle={selectedLead ? `ref: ${selectedLead._id.substring(0, 8)}` : ''}
        onSave={handleSaveLead}
        onCancel={handleRevertLeadEdits}
        hasChanges={hasLeadChanges}
        isSaving={updateMutation.isPending}
        saveDisabled={Object.keys(fieldErrors).length > 0}
        extraActions={
          <Button
            variant="mint"
            size="sm"
            disabled={updateMutation.isPending}
            onClick={async () => {
              if (!selectedLead) return;
              const { valid, errors, sanitized } = validateLeadFormFields(editLeadData);
              if (!valid) {
                setFieldErrors(errors);
                toast.error(Object.values(errors)[0] || 'Fix highlighted fields first');
                return;
              }
              try {
                const updatedData = {
                  ...sanitized,
                  callStatus: sanitized.callStatus === 'Pending' ? 'Connected' : sanitized.callStatus,
                  nextFollowupDate: '',
                  nextFollowupTime: '',
                  remarks: (sanitized.remarks ? sanitized.remarks + '\n' : '') + `[Follow-up done on ${format(new Date(), 'dd-MM-yyyy')}]`
                };
                await updateMutation.mutateAsync({
                  id: selectedLead._id,
                  data: updatedData
                });
                toast.success('Follow-up marked done');
                setSelectedLead(null);
              } catch (err) {
                toast.error(err.response?.data?.error || err.message || 'Failed to update lead');
              }
            }}
            className="flex items-center gap-1.5"
          >
            <CheckCircle2 size={16} /> <span className="hidden sm:inline">Mark as Done</span>
          </Button>
        }
        sidebar={
          <div className="space-y-4 animate-fade-in">
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Current Status</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold">Stage</span>
                  <Badge variant={selectedLead?.leadStatus === 'Converted' ? 'mint' : 'info'}>{selectedLead?.leadStatus || 'Fresh'}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold">Call Status</span>
                  <Badge variant="neutral">{selectedLead?.callStatus || 'Pending'}</Badge>
                </div>
                {selectedLead?.nextFollowupDate && (
                  <div className="pt-2 border-t border-[var(--color-bg-border)] flex justify-between items-center text-[10px]">
                    <span className="font-bold flex items-center gap-1 text-blue-400"><Clock size={12} /> Follow-up</span>
                    <span className="font-mono">{selectedLead.nextFollowupDate} {selectedLead.nextFollowupTime}</span>
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Assigned Agent</h4>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center overflow-hidden">
                  {selectedLead?.assignedRep?.avatar ? <img src={selectedLead.assignedRep.avatar} className="w-full h-full object-cover" alt="" /> : <Users size={18} className="text-[var(--color-text-muted)]" />}
                </div>
                <div>
                  <p className="text-[11px] font-bold">{selectedLead?.assignedRep?.name || 'Unassigned'}</p>
                  <p className="text-[9px] text-[var(--color-text-muted)] uppercase">Sales Professional</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5 border-b border-[var(--color-bg-border)] pb-2">
                <History size={12} /> Audit Trail
              </h4>
              {leadLogs.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 text-[11px] custom-scrollbar">
                  {leadLogs.map((log, index) => (
                    <div key={index} className="border-b border-[var(--color-bg-border)] pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-[9px] text-[var(--color-text-muted)] font-mono">
                        <span className="font-bold text-[var(--color-text-primary)]">{log.userId?.name || 'System / Batch'}</span>
                        <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                        Changed <span className="font-bold text-blue-400">{log.fieldChanged}</span> from <span className="line-through text-[var(--color-text-muted)]">{log.oldValue || '(empty)'}</span> to <span className="font-bold text-emerald-400">{log.newValue || '(empty)'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] text-center py-2">No edits recorded yet</p>
              )}
            </Card>
          </div>
        }
      >
        <div className="space-y-8">
          {Object.keys(fieldErrors).length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
              Fix highlighted fields before saving.
            </div>
          )}
          {/* Funnel Mapping */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <Layers size={14} /> Overflow.io Conversion Funnel
              </h3>
              <Badge variant="mint" className="font-mono text-[9px]">overflow.io map</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[var(--color-bg-secondary)]/30 p-4 rounded-2xl border border-[var(--color-bg-border)]">
              {[
                { stage: '1. Discovery', desc: `Captured via ${selectedLead?.source || 'Direct'}`, status: 'Passed', color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
                { stage: '2. Enrichment', desc: `Quality Scored: Level ${editLeadData.leadQuality}`, status: 'Passed', color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
                { stage: '3. Engagement', desc: `Call Touchpoint: ${editLeadData.callStatus}`, status: editLeadData.callStatus && editLeadData.callStatus !== 'Pending' ? 'Passed' : 'Active', color: 'border-purple-500 text-purple-400 bg-purple-500/10' },
                { stage: '4. Conversion', desc: 'Member Onboarded & Subscribed', status: editLeadData.leadStatus === 'Converted' ? 'Passed' : 'Pending', color: editLeadData.leadStatus === 'Converted' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-slate-700 text-slate-500 bg-slate-900/40' },
              ].map((step, index) => (
                <div key={index} className={`p-3 rounded-xl border relative flex flex-col justify-between transition-all hover:scale-[1.02] cursor-pointer ${step.color}`}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase">{step.stage}</span>
                      <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/40 font-mono">{step.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-medium leading-tight">{step.desc}</p>
                  </div>
                  <div className="pt-2 mt-2 border-t border-current/20 flex items-center justify-between text-[9px] font-mono opacity-80">
                    <span>Pulse {index + 1}</span>
                    <GitCommit size={12} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Lead Stages & Interaction Updates */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
              <Briefcase size={14} /> Mission & Pipeline Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-bg-border)]">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Lead Funnel Stage</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
                  value={editLeadData.leadStatus}
                  onChange={e => setEditLeadData({ ...editLeadData, leadStatus: e.target.value })}
                >
                  {leadStatusesList.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Call Outcome Status</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
                  value={editLeadData.callStatus}
                  onChange={e => setEditLeadData({ ...editLeadData, callStatus: e.target.value })}
                >
                  {callStatusesList.map(cs => <option key={cs} value={cs}>{cs}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Lead Quality Score</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
                  value={editLeadData.leadQuality}
                  onChange={e => setEditLeadData({ ...editLeadData, leadQuality: e.target.value })}
                >
                  {qualitiesList.map(q => <option key={q} value={q}>Level {q}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Conversion Plan / Status</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
                  value={editLeadData.planOption || ''}
                  onChange={e => setEditLeadData({ ...editLeadData, planOption: e.target.value, ...(e.target.value ? { leadStatus: 'Converted' } : {}) })}
                >
                  <option value="">Select Plan (None)</option>
                  <option value="One-Time">One-Time Payment</option>
                  <option value="3 Mo">3 Months Plan</option>
                  <option value="6 Mo">6 Months Plan</option>
                  <option value="9 Mo">9 Months Plan</option>
                </select>
              </div>
            </div>
          </section>

          {/* Followup & Reminder Schedule */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
              <Calendar size={14} /> Schedule Follow-up & Reminder
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-blue-500/5 rounded-2xl border border-blue-500/20">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-blue-300">Follow-up Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-blue-500/30 rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none cursor-pointer"
                  value={editLeadData.nextFollowupDate}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                  onFocus={e => e.target.showPicker && e.target.showPicker()}
                  onKeyDown={e => e.preventDefault()}
                  onChange={e => setEditLeadData({ ...editLeadData, nextFollowupDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-blue-300">Follow-up Time</label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-blue-500/30 rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none cursor-pointer"
                  value={editLeadData.nextFollowupTime}
                  onClick={e => e.target.showPicker && e.target.showPicker()}
                  onFocus={e => e.target.showPicker && e.target.showPicker()}
                  onKeyDown={e => e.preventDefault()}
                  onChange={e => setEditLeadData({ ...editLeadData, nextFollowupTime: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-start pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                    checked={editLeadData.setReminder}
                    onChange={e => setEditLeadData({ ...editLeadData, setReminder: e.target.checked })}
                  />
                  <span className="text-xs font-bold flex items-center gap-1.5 text-blue-200">
                    <Bell size={14} className="text-blue-400" /> Enable Overdue Alerts / Reminders
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Contact Details */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
              <UserCheck size={14} /> Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <Input
                label="Customer Name"
                value={editLeadData.name}
                error={fieldErrors.name}
                onChange={e => patchEditLeadData({ name: e.target.value })}
              />
              <PhoneNumberFields
                countryCode={editLeadData.phoneCountryCode}
                nationalNumber={editLeadData.phoneNational}
                error={fieldErrors.phone}
                onCountryCodeChange={(phoneCountryCode) => patchEditLeadData({ phoneCountryCode })}
                onNationalNumberChange={(phoneNational) => patchEditLeadData({ phoneNational })}
              />
              <Input
                label="Location / City"
                value={editLeadData.city}
                onChange={e => patchEditLeadData({ city: e.target.value })}
                icon={MapPin}
              />
              <Input label="Original Lead Source" defaultValue={selectedLead?.source || 'Direct'} icon={Globe} readOnly />
            </div>
          </section>

          {/* Remarks & Notes Timeline */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <MessageSquare size={14} /> Interaction Activity & Notes Stream
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">General Remarks / Brief</label>
                <Input
                  placeholder="General remarks or notes..."
                  value={editLeadData.remarks}
                  onChange={e => setEditLeadData({ ...editLeadData, remarks: e.target.value })}
                />
              </div>

              {/* Notes List */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Notes History</label>
                {selectedLead?.notes && selectedLead.notes.length > 0 ? (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-2">
                    {selectedLead.notes.map((note, index) => (
                      <div key={index} className="p-3.5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-bg-border)] space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-mono">
                          <span className="font-bold text-[var(--color-text-primary)]">{note.author}</span>
                          <span>{new Date(note.date).toLocaleString()}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-200">{note.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-bg-border)] opacity-60">
                     <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">No notes recorded yet</p>
                  </div>
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="flex gap-2 pt-2">
                <div className="flex-1">
                  <Input
                    placeholder="Type an update or interaction note here..."
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="primary" disabled={addingNote || !newNoteText.trim()}>
                  <Send size={14} /> {addingNote ? 'Adding...' : 'Add Note'}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </FullScreenWorkspace>
    </ListPageLayout>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
