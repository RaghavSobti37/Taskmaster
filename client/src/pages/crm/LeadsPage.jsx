import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Trash2, CheckCircle2,
  Database, TrendingUp, UserCheck, Briefcase, Users, Zap, Target, Clock, MapPin, Globe, GitCommit, Layers, Calendar, MessageSquare, Send, Bell, History, UserPlus
} from 'lucide-react';
import {
  Badge,
  PageHeader,
  Card,
  PageContainer,
  DataTable,
  Button,
  StatCard,
  PageSkeleton,
  FullScreenWorkspace,
  Input,
  NexusDropdown,
  Modal
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLiveLeads, useSalesReps, useCRMStats, useUpdateLead, useCreateLead, useCRMConfig } from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { formatExlyTag } from '../../utils/crmUtils';
import { validateLeadFormFields } from '../../utils/leadFormValidation';
import { buildLeadEditState, leadEditHasChanges } from '../../utils/leadEditState';
import PhoneNumberFields from '../../components/crm/PhoneNumberFields';
import { useDebounce } from '../../hooks/useDebounce';

export default function LeadsPage() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedLead, setSelectedLead] = useState(null);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statFilter, setStatFilter] = useState(null);
  const [filters, setFilters] = useState({ leadStatus: 'all', meaningfulConnect: 'all' });

  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [leadLogs, setLeadLogs] = useState([]);
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState({
    name: '', phoneCountryCode: '+91', phoneNational: '', email: '', city: '', leadStatus: 'New', leadQuality: '3', source: 'Organic / Direct', remarks: ''
  });
  const [newLeadErrors, setNewLeadErrors] = useState({});

  const updateMutation = useUpdateLead();
  const createMutation = useCreateLead();
  const [editLeadData, setEditLeadData] = useState({
    name: '', phoneCountryCode: '+91', phoneNational: '', city: '', leadQuality: '3', leadStatus: 'New', callStatus: 'Pending', remarks: '', nextFollowupDate: '', nextFollowupTime: '', setReminder: false, planOption: '', assignedRepId: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editBaseline, setEditBaseline] = useState(null);

  const applyLeadValidation = (data) => {
    const { errors } = validateLeadFormFields(data);
    setFieldErrors(errors);
    return errors;
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
      await updateMutation.mutateAsync({
        id: selectedLead._id,
        data: sanitized,
      });
      toast.success('Lead saved');
      setSelectedLead(null);
      setFieldErrors({});
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save lead');
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    const ok = await confirm({
      title: 'Remove lead?',
      message: `Confirm removal of ${selectedLead.name}? Action is permanent.`,
      confirmLabel: 'Remove',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/crm/leads/${selectedLead._id}`);
      setSelectedLead(null);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedLead) return;
    
    const noteText = newNoteText;
    setNewNoteText('');
    
    // Optimistic UI update
    const optimisticNote = {
      text: noteText,
      author: user?.name || user?.email || 'You',
      date: new Date().toISOString()
    };
    
    setSelectedLead(prev => ({
      ...prev,
      notes: [...(prev?.notes || []), optimisticNote]
    }));

    queryClient.setQueryData(['leads', queryParams], oldData => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        leads: oldData.leads.map(lead => 
          lead._id === selectedLead._id ? { ...lead, notes: [...(lead.notes || []), optimisticNote] } : lead
        )
      };
    });

    try {
      const res = await axios.post(`/api/crm/leads/${selectedLead._id}/notes`, { text: noteText });
      setSelectedLead(res.data);
    } catch (err) {
      alert('Failed to add note');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    const { valid, errors, sanitized } = validateLeadFormFields(newLeadData);
    setNewLeadErrors(errors);
    if (!valid) {
      toast.error(errors.phone || Object.values(errors)[0] || 'Fix highlighted fields before creating');
      return;
    }
    if (!sanitized.name || (!sanitized.phone && !sanitized.email)) {
      toast.error('Provide a customer name and either a phone or email.');
      return;
    }
    try {
      await createMutation.mutateAsync(sanitized);
      setIsAddModalOpen(false);
      setNewLeadData({ name: '', phoneCountryCode: '+91', phoneNational: '', email: '', city: '', leadStatus: 'New', leadQuality: '3', source: 'Organic / Direct', remarks: '' });
      setNewLeadErrors({});
      toast.success('Lead created');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to create lead');
    }
  };

  useEffect(() => {
    if (statFilter === 'warm') {
      // Warm card should show only warm leads, not all meaningful connections.
      setFilters(prev => ({ ...prev, leadStatus: 'Warm', meaningfulConnect: 'all' }));
    } else if (statFilter === 'converted') {
      setFilters(prev => ({ ...prev, leadStatus: 'Converted', meaningfulConnect: 'all' }));
    } else {
      setFilters(prev => ({ ...prev, leadStatus: 'all', meaningfulConnect: 'all' }));
    }
  }, [statFilter]);

  const queryParams = useMemo(() => ({
    page,
    limit: pageSize,
    search: debouncedSearch,
    sort: sortField,
    order: sortOrder,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== 'all'))
  }), [page, pageSize, debouncedSearch, filters, sortField, sortOrder]);



  const { data, isLoading } = useLiveLeads(queryParams);
  const { data: statsData } = useCRMStats();
  const { data: team = [] } = useSalesReps();
  const { data: crmConfig } = useCRMConfig();

  const leads = data?.leads || [];
  const totalLeads = data?.total || 0;
  const totalPages = data?.pages || 1;
  const sourcesList = crmConfig?.sources || ['Organic / Direct', 'Webinar', 'Facebook Ads', 'Google Ads', 'Referral'];
  const leadStatusesList = crmConfig?.leadStatuses || ['New', 'Contacted', 'Warm', 'Hot', 'Qualified', 'Proposal', 'Converted', 'Lost'];
  const callStatusesList = crmConfig?.callStatuses || ['Pending', 'Connected', 'Busy', 'DNP', 'Switched Off'];
  const qualitiesList = crmConfig?.qualities || ['1', '2', '3', '4', '5', 'Future 4'];

  const columns = [
    {
      header: 'Customer Details',
      render: (row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs tracking-tight">{row?.name || 'Unknown'}</span>
            {row.artistType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] font-normal tracking-tight">
                {row.artistType.replace(' Artiste', '')}
              </span>
            )}
            {row.primaryRole && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-action-primary)]/10 border border-[var(--color-action-primary)]/20 text-[var(--color-action-primary)] font-normal tracking-tight">
                {row?.primaryRole}
              </span>
            )}
            {row.source && (!row.exlyOfferingTitle || (row.source !== 'Exly Offering' && row.source !== row.exlyOfferingTitle)) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold tracking-tight">
                {row?.source}
              </span>
            )}
            {row.exlyOfferingTitle && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold tracking-tight">
                {formatExlyTag(row.exlyOfferingTitle)}
              </span>
            )}
            {row.emailStatus && row.emailStatus !== 'Pending' && (
              <Badge variant={row.emailStatus === 'Active' ? 'mint' : row.emailStatus === 'Unsubscribed' ? 'warning' : 'rose'}>
                {row?.emailStatus}
              </Badge>
            )}
            {row.nextFollowupDate && (
              <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full font-bold uppercase flex items-center gap-1">
                <Clock size={10} /> {row?.nextFollowupDate}{row?.nextFollowupTime ? ` ${row.nextFollowupTime}` : ''}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{row?.email || ''} {row?.phone ? `• ${row?.phone}` : ''} {row?.city ? `• ${row?.city}` : ''}</span>
        </div>
      )
    },
    {
      header: 'Quality Score',
      info: 'How likely this person is to join based on their recent interactions.',
      render: (row) => (
        <Badge variant={Number(row.leadQuality) >= 4 || row.leadQuality === 'Future 4' ? 'mint' : Number(row.leadQuality) >= 2 ? 'info' : 'apricot'}>
          LEVEL {row?.leadQuality}
        </Badge>
      )
    },
    {
      header: 'Interest Level',
      render: (row) => (
        <Badge variant={row.leadStatus === 'Converted' ? 'mint' : row.leadStatus === 'Hot' ? 'danger' : row.leadStatus === 'Warm' ? 'warning' : 'slate'}>
          {row.leadStatus?.toUpperCase() || 'NEW'}
        </Badge>
      )
    },
    {
      header: 'Assigned Agent',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center overflow-hidden shrink-0">
            {row.assignedRep?.avatar ? <img src={row.assignedRep.avatar} className="w-full h-full object-cover" alt="" /> : <Users size={12} className="text-[var(--color-text-muted)]" />}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tight truncate">{row.assignedRep?.name || 'Pending Assignment'}</span>
        </div>
      )
    }
  ];

  if (isLoading && page === 1 && !searchTerm) return <PageSkeleton />;

  const stats = statsData || { totalLeads: 0, convertedLeads: 0, warmLeads: 0, conversionRate: 0, activeReach: 0 };
  const isAdmin = isAdminUser(user);

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Customer Leads"
        icon={UserPlus}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={14} /> Add Lead
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${!statFilter ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
          <StatCard
            label="Total Leads"
            value={stats.totalLeads}
            icon={Users}
            variant="mint"
            info="Total leads visible in your scope."
            onClick={() => setStatFilter(null)}
            className="border-0"
          />
        </div>

        <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${statFilter === 'warm' ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
          <StatCard
            label="Warm Leads"
            value={stats.warmLeads}
            icon={TrendingUp}
            variant="rose"
            info="Leads with meaningful connection and not converted."
            onClick={() => setStatFilter(statFilter === 'warm' ? null : 'warm')}
            className="border-0"
          />
        </div>

        <div className={`rounded-[var(--radius-atomic)] border-2 transition-all ${statFilter === 'converted' ? 'border-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20' : 'border-[var(--color-bg-border)]'}`}>
          <StatCard
            label="Converted"
            value={stats.convertedLeads}
            icon={CheckCircle2}
            variant="apricot"
            info="Leads converted into paying customers."
            onClick={() => setStatFilter(statFilter === 'converted' ? null : 'converted')}
            className="border-0"
          />
        </div>

        <div className="rounded-[var(--radius-atomic)] border-2 border-[var(--color-bg-border)] transition-all">
          <StatCard
            label="Success Rate"
            value={`${Number(stats.conversionRate).toFixed(1)}%`}
            icon={Target}
            variant="info"
            info="Converted leads divided by total leads."
            className="border-0"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-56">
              <Input
                placeholder="Search name or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                icon={Search}
              />
            </div>
            <div className="w-44">
              <NexusDropdown
                placeholder="Interest Level"
                options={[
                  { value: 'all', label: 'All Interest Levels' },
                  ...leadStatusesList.map(s => ({ value: s, label: s }))
                ]}
                value={filters.leadStatus}
                onChange={v => setFilters({ ...filters, leadStatus: v })}
              />
            </div>
            <div className="w-56">
              <NexusDropdown
                placeholder="Source"
                options={[{ value: 'all', label: 'All Sources' }, ...sourcesList.map(s => ({ value: s, label: s }))]}
                value={filters.source}
                onChange={v => setFilters({ ...filters, source: v })}
              />
            </div>
            <div className="w-36">
              <NexusDropdown
                placeholder="Quality"
                options={[
                  { value: 'all', label: 'All Quality' },
                  ...qualitiesList.map(q => ({ value: q, label: `Level ${q}` }))
                ]}
                value={filters.leadQuality}
                onChange={v => setFilters({ ...filters, leadQuality: v })}
              />
            </div>
            <div className="w-44">
              <NexusDropdown
                placeholder="Agent"
                options={[{ value: 'all', label: 'All Agents' }, { value: 'unassigned', label: 'Unassigned' }, ...team.map(r => ({ value: r._id, label: r.name }))]}
                value={filters.assignedRepId}
                onChange={v => setFilters({ ...filters, assignedRepId: v })}
              />
            </div>
            <div className="w-56">
              <NexusDropdown
               
                placeholder="Sort by"
                options={[
                  { value: 'createdAt-desc', label: 'Newest First' },
                  { value: 'createdAt-asc', label: 'Oldest First' },
                  { value: 'leadQuality-desc', label: 'Quality Score (High-Low)' },
                  { value: 'nextFollowupDate-asc', label: 'Followup Date (Earliest)' },
                  { value: 'name-asc', label: 'Name (A-Z)' }
                ]}
                value={`${sortField}-${sortOrder}`}
                onChange={v => {
                  const [field, order] = v.split('-');
                  setSortField(field);
                  setSortOrder(order);
                }}
              />
            </div>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <DataTable
            columns={columns}
            data={leads}
            onRowClick={(row) => setSelectedLead(row)}
            paginated={true}
            serverSide={true}
            totalItems={totalLeads}
            totalPages={totalPages}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </Card>
      </div>

      <FullScreenWorkspace
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.name || 'Customer Details'}
        subtitle={selectedLead ? `ref: ${selectedLead._id?.substring(0, 8) || '—'}` : ''}
        onSave={handleSaveLead}
        onCancel={handleRevertLeadEdits}
        hasChanges={hasLeadChanges}
        isSaving={updateMutation.isPending}
        saveDisabled={Object.keys(fieldErrors).length > 0}
        extraActions={
          <div className="flex items-center gap-2">
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
                    remarks: (sanitized.remarks ? sanitized.remarks + '\n' : '') + `[Follow-up done on ${new Date().toLocaleDateString('en-GB')}]`
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
            {isAdmin && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteLead}
                className="flex items-center gap-1.5"
              >
                <Trash2 size={16} /> <span className="hidden sm:inline">Delete Lead</span>
              </Button>
            )}
          </div>
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
                {selectedLead?.unsubscribed && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-rose-400">Preference</span>
                    <Badge variant="rose">Unsubscribed</Badge>
                  </div>
                )}
                {selectedLead?.unsubscribeReason && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-rose-400">Opt-out Reason</span>
                    <span className="text-[10px] font-mono text-rose-400">{selectedLead.unsubscribeReason}</span>
                  </div>
                )}
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
                <Zap size={12} className="text-purple-500" /> Exly Offerings
              </h4>
              <div className="space-y-3">
                {(() => {
                  const offerings = selectedLead?.exlyOfferings?.length > 0 
                    ? selectedLead.exlyOfferings 
                    : selectedLead?.exlyOfferingTitle ? [{ title: selectedLead.exlyOfferingTitle, purchasedAt: selectedLead.createdAt }] : [];
                  
                  if (offerings.length === 0) {
                    return <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] text-center py-2">No offerings found</p>;
                  }

                  return offerings.map((off, idx) => (
                    <div key={idx} className="flex flex-col gap-1 pb-2 border-b border-[var(--color-bg-border)] last:border-0 last:pb-0">
                      <span className="text-[11px] font-bold text-[var(--color-text-primary)]">{off.title}</span>
                      {off.purchasedAt && (
                        <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
                          {new Date(off.purchasedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ));
                })()}
              </div>
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
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
                  value={editLeadData.leadStatus}
                  onChange={e => setEditLeadData({ ...editLeadData, leadStatus: e.target.value })}
                >
                  {leadStatusesList.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Call Outcome Status</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
                  value={editLeadData.callStatus}
                  onChange={e => setEditLeadData({ ...editLeadData, callStatus: e.target.value })}
                >
                  {callStatusesList.map(cs => <option key={cs} value={cs}>{cs}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Lead Quality Score</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
                  value={editLeadData.leadQuality}
                  onChange={e => setEditLeadData({ ...editLeadData, leadQuality: e.target.value })}
                >
                  {qualitiesList.map(q => <option key={q} value={q}>Level {q}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Assigned Sales Rep</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
                  value={editLeadData.assignedRepId || ''}
                  onChange={e => setEditLeadData({ ...editLeadData, assignedRepId: e.target.value || undefined })}
                >
                  <option value="" disabled>Pending Assignment</option>
                  {team.map(rep => (
                    <option key={rep._id} value={rep._id}>{rep.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Conversion Plan / Status</label>
                <select
                  className="w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
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
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-blue-500/30 rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none cursor-pointer"
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
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-blue-500/30 rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none cursor-pointer"
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

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Lead"
        showFooter={false}
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <Input
            label="Customer Name *"
            placeholder="John Doe"
            value={newLeadData.name}
            onChange={e => setNewLeadData({ ...newLeadData, name: e.target.value })}
            required
          />
          <PhoneNumberFields
            countryCode={newLeadData.phoneCountryCode}
            nationalNumber={newLeadData.phoneNational}
            error={newLeadErrors.phone}
            onCountryCodeChange={(phoneCountryCode) => {
              const next = { ...newLeadData, phoneCountryCode };
              setNewLeadData(next);
              setNewLeadErrors(validateLeadFormFields(next).errors);
            }}
            onNationalNumberChange={(phoneNational) => {
              const next = { ...newLeadData, phoneNational };
              setNewLeadData(next);
              setNewLeadErrors(validateLeadFormFields(next).errors);
            }}
          />
          <Input
            label="Email Address"
            placeholder="john@example.com"
            value={newLeadData.email}
            onChange={e => setNewLeadData({ ...newLeadData, email: e.target.value })}
          />
          <Input
            label="City / Location"
            placeholder="Mumbai"
            value={newLeadData.city}
            onChange={e => setNewLeadData({ ...newLeadData, city: e.target.value })}
          />
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Interest Level</label>
            <select
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
              value={newLeadData.leadStatus}
              onChange={e => setNewLeadData({ ...newLeadData, leadStatus: e.target.value })}
            >
              {leadStatusesList.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Lead Quality Score</label>
            <select
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-blue-500 outline-none"
              value={newLeadData.leadQuality}
              onChange={e => setNewLeadData({ ...newLeadData, leadQuality: e.target.value })}
            >
              <option value="1">Level 1 - Unlikely</option>
              <option value="2">Level 2 - Mild Interest</option>
              <option value="3">Level 3 - Strong Candidate</option>
              <option value="4">Level 4 - Very High Interest</option>
              <option value="5">Level 5 - Imminent Conversion</option>
            </select>
          </div>
          <Input
            label="Initial Remarks / Notes"
            placeholder="Interested in weekend music production batch..."
            value={newLeadData.remarks}
            onChange={e => setNewLeadData({ ...newLeadData, remarks: e.target.value })}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
