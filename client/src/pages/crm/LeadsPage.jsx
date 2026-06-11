import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Trash2, CheckCircle2,
  Database, UserCheck, Briefcase, Users, Zap, Target, Clock, MapPin, Globe, Calendar, MessageSquare, Send, Bell, History, UserPlus, Mail
} from 'lucide-react';
import { Badge, Card, DataTable, Button, Input, PageSkeleton, ListPageLayout, SearchInput, UserLabel, FullScreenWorkspace, NexusDropdown, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { Modal } from '../../components/ui/modals';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLiveLeads, useSalesReps, useArtistReps, useCRMStats, useUpdateLead, useCreateLead, useCRMConfig, useLeadDetail } from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { formatExlyTag, MEANINGFUL_CONNECT_OPTIONS, formatMeaningfulConnect, meaningfulConnectBadgeVariant } from '../../utils/crmUtils';
import { validateLeadFormFields } from '../../utils/leadFormValidation';
import { buildLeadEditState, leadEditHasChanges } from '../../utils/leadEditState';
import PhoneNumberFields from '../../components/crm/PhoneNumberFields';
import LeadLockIndicator from '../../components/crm/LeadLockIndicator';
import LeadRowActions from '../../components/crm/LeadRowActions';
import { useDebounce } from '../../hooks/useDebounce';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { applyFlashHighlight } from '../../utils/navigationHighlight';
import { crmQueryParamsForUser, isArtistOnlyCrmUser, isArtistCrmContext } from '../../utils/crmScope';
import LeadArtistJourneySection from '../../components/crm/LeadArtistJourneySection';
import ArtistCrmImportPanel from '../../components/crm/ArtistCrmImportPanel';
import ArtistBookingEnquiryPanel from '../../components/crm/ArtistBookingEnquiryPanel';
import { isArtistBookingEnquiry } from '../../utils/artistBookingEnquiry';
import { isLockedByOther, formatLockToast, closeLeadEditor } from '../../utils/crmLeadLock';

const CRM_LEADS_FILTERS_KEY = 'crm-leads-filters';

const CRM_FIELD_SELECT = 'w-full px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none';

const loadLeadsFilters = () => {
  try {
    const raw = localStorage.getItem(CRM_LEADS_FILTERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    leadStatus: 'all',
    meaningfulConnect: 'all',
    warmPipeline: false,
    source: 'all',
    leadQuality: 'all',
    assignedRepId: 'all',
    pageSize: 10,
  };
};

export default function LeadsPage() {
  const { user } = useAuth();
  const artistMode = isArtistOnlyCrmUser(user);
  const [searchParams] = useSearchParams();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadLeadsFilters().pageSize || 10);
  const [selectedLead, setSelectedLead] = useState(null);
  const artistRepContext = isArtistCrmContext(user, selectedLead);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statFilter, setStatFilter] = useState(null);
  const [filters, setFilters] = useState(() => {
    const saved = loadLeadsFilters();
    const { pageSize: _ps, ...rest } = saved;
    return rest;
  });

  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [leadLogs, setLeadLogs] = useState([]);
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState({
    name: '', phoneCountryCode: '+91', phoneNational: '', email: '', city: '', leadStatus: 'New', leadQuality: '3', source: 'Organic / Direct', remarks: ''
  });
  const [newLeadErrors, setNewLeadErrors] = useState({});

  const { data: leadDetail } = useLeadDetail(selectedLead?._id, !!selectedLead);
  const detailLead = leadDetail || selectedLead;

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

  useEffect(() => {
    try {
      localStorage.setItem(CRM_LEADS_FILTERS_KEY, JSON.stringify({ ...filters, pageSize }));
    } catch {
      /* ignore */
    }
  }, [filters, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  React.useEffect(() => {
    if (selectedLead) {
      const loaded = buildLeadEditState(selectedLead);
      setEditLeadData(loaded);
      setEditBaseline(loaded);
      applyLeadValidation(loaded);

      // Fetch audit trail for the selected lead
      axios.get(`/api/crm/leads/${selectedLead._id}/audit`)
        .then(res => setLeadLogs(res.data))
        .catch(() => setLeadLogs([]));

      const heartbeat = window.setInterval(() => {
        axios.post(`/api/crm/leads/${selectedLead._id}/lock-heartbeat`, null, {
          headers: { 'x-skip-toast': 'true' },
        }).catch(() => {});
      }, 30_000);

      return () => window.clearInterval(heartbeat);
    }
    setLeadLogs([]);
    setFieldErrors({});
    setEditBaseline(null);
    return undefined;
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
      closeLeadEditor(selectedLead._id, setSelectedLead);
      setFieldErrors({});
    } catch (err) {
      if (err.response?.status === 423) {
        toast.error(formatLockToast(err));
        return;
      }
      toast.error(err.response?.data?.error || err.message || 'Failed to save lead');
    }
  };

  useUnsavedChanges({
    baseline: editBaseline,
    draft: editLeadData,
    setDraft: setEditLeadData,
    hasChanges: hasLeadChanges && !!selectedLead,
    onSave: handleSaveLead,
    onCancel: handleRevertLeadEdits,
    isSaving: updateMutation.isPending,
    enabled: !!selectedLead,
    elevated: true,
  });

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
      closeLeadEditor(selectedLead._id, setSelectedLead);
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
    if (statFilter === 'meaningful') {
      setFilters((prevFilters) => ({
        ...prevFilters,
        leadStatus: 'all',
        meaningfulConnect: 'YES',
        warmPipeline: false,
      }));
      return;
    }
    if (statFilter === 'converted') {
      setFilters((prevFilters) => ({
        ...prevFilters,
        leadStatus: 'Converted',
        meaningfulConnect: 'all',
        warmPipeline: false,
      }));
    }
  }, [statFilter]);

  const clearStatFilters = () => {
    setStatFilter(null);
    setFilters((prev) => ({
      ...prev,
      leadStatus: 'all',
      meaningfulConnect: 'all',
      warmPipeline: false,
    }));
  };

  const toggleMeaningfulStatFilter = () => {
    if (statFilter === 'meaningful') {
      clearStatFilters();
      return;
    }
    setStatFilter('meaningful');
  };

  const toggleConvertedStatFilter = () => {
    if (statFilter === 'converted') {
      clearStatFilters();
      return;
    }
    setStatFilter('converted');
  };

  const queryParams = useMemo(() => crmQueryParamsForUser(user, {
    page,
    limit: pageSize,
    search: debouncedSearch,
    sort: sortField,
    order: sortOrder,
    ...(artistMode ? { excludeContactCategory: 'booking_enquiry' } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => {
      if (k === 'warmPipeline') return v === true;
      return v !== 'all';
    })),
  }), [user, artistMode, page, pageSize, debouncedSearch, filters, sortField, sortOrder]);



  const { data, isLoading, isError, error, refetch } = useLiveLeads(queryParams);
  const statsParams = useMemo(() => (artistMode ? { crmType: 'artist' } : {}), [artistMode]);
  const { data: statsData } = useCRMStats(true, { queryParams: statsParams });
  const { data: salesTeam = [] } = useSalesReps(!artistRepContext);
  const { data: artistTeam = [] } = useArtistReps(artistRepContext);
  const team = artistRepContext ? artistTeam : salesTeam;
  const { data: crmConfig } = useCRMConfig();

  const leads = data?.leads || [];
  const totalLeads = data?.total || 0;
  const totalPages = data?.pages || 1;
  const highlightHandledRef = useRef(null);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId || highlightHandledRef.current === highlightId) return;
    const match = leads.find((l) => String(l._id) === highlightId);
    if (match) {
      highlightHandledRef.current = highlightId;
      setSelectedLead(match);
      applyFlashHighlight(highlightId);
      return;
    }
    axios.get(`/api/crm/leads/${highlightId}`)
      .then((res) => {
        highlightHandledRef.current = highlightId;
        setSelectedLead(res.data);
        applyFlashHighlight(highlightId);
      })
      .catch(() => {});
  }, [searchParams, leads]);
  const sourcesList = crmConfig?.sources || ['Organic / Direct', 'Webinar', 'Facebook Ads', 'Google Ads', 'Referral'];
  const leadStatusesList = crmConfig?.leadStatuses || ['New', 'Contacted', 'Warm', 'Hot', 'Qualified', 'Proposal', 'Converted', 'Lost'];
  const callStatusesList = crmConfig?.callStatuses || ['Pending', 'Connected', 'Busy', 'DNP', 'Switched Off'];
  const qualitiesList = crmConfig?.qualities || ['1', '2', '3', '4', '5', 'Future 4'];
  const meaningfulConnectList = crmConfig?.meaningfulConnectStatuses || ['YES', 'NO', 'PENDING'];

  const isDefaultSort = sortField === 'createdAt' && sortOrder === 'desc';
  const tableSortState = useMemo(
    () => (isDefaultSort ? null : { key: sortField, direction: sortOrder }),
    [sortField, sortOrder, isDefaultSort]
  );

  const handleTableSortChange = (next) => {
    if (!next) {
      setSortField('createdAt');
      setSortOrder('desc');
    } else {
      setSortField(next.key);
      setSortOrder(next.direction);
    }
    setPage(1);
  };

  const columns = [
    {
      header: 'Customer Details',
      sortKey: 'name',
      mobilePrimary: true,
      mobileSubtitle: (row) => [row?.email, row?.phone].filter(Boolean).join(' • '),
      render: (row) => (
        <div className={`relative flex flex-col gap-1.5 pr-16 ${isLockedByOther(row, user?._id) ? 'opacity-60' : ''}`}>
          <LeadRowActions
            onEdit={() => setSelectedLead(row)}
            onHistory={() => setSelectedLead(row)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <LeadLockIndicator lead={row} currentUserId={user?._id} />
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
            {artistMode && row.metadata?.publication && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-normal tracking-tight">
                {row.metadata.publication}
              </span>
            )}
            {artistMode && row.contactCategory && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-300 font-normal tracking-tight">
                {row.contactCategory.replace(/_/g, ' ')}
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
      sortKey: 'leadQuality',
      info: 'How likely this person is to join based on their recent interactions.',
      render: (row) => (
        <Badge variant={Number(row.leadQuality) >= 4 || row.leadQuality === 'Future 4' ? 'mint' : Number(row.leadQuality) >= 2 ? 'info' : 'apricot'}>
          LEVEL {row?.leadQuality}
        </Badge>
      )
    },
    {
      header: 'Interest Level',
      sortKey: 'leadStatus',
      info: 'Pipeline stage from Fresh through Converted — filters how sales prioritizes outreach.',
      render: (row) => (
        <Badge variant={row.leadStatus === 'Converted' ? 'mint' : row.leadStatus === 'Hot' ? 'danger' : row.leadStatus === 'Warm' ? 'warning' : 'slate'}>
          {row.leadStatus?.toUpperCase() || 'NEW'}
        </Badge>
      )
    },
    {
      header: 'Created',
      sortKey: 'createdAt',
      mobileHidden: true,
      sortFn: (row) => (row.createdAt ? new Date(row.createdAt) : null),
      render: (row) => (
        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      header: artistMode ? 'Assigned Manager' : 'Assigned Agent',
      sortable: false,
      render: (row) => (
        <UserLabel
          user={row.assignedRep}
          name={row.assignedRep?.name || 'Pending Assignment'}
          size="xs"
          nameClassName="text-[10px] font-black uppercase tracking-tight truncate"
        />
      )
    }
  ];

  if (isLoading && page === 1 && !searchTerm) return <PageSkeleton />;

  const stats = statsData || { totalLeads: 0, convertedLeads: 0, warmLeads: 0, conversionRate: 0, activeReach: 0 };
  const meaningfulConnectCount = stats.activeReach ?? stats.meaningful ?? stats.warmLeads ?? 0;
  const isAdmin = isAdminUser(user);
  const otherPipeline = Math.max(0, stats.totalLeads - stats.convertedLeads - meaningfulConnectCount);

  return (
    <ListPageLayout
      containerClassName="!py-4"
      toolbarFill
      overviewMobileMaxStats={2}
      overview={{
        stats: [
          {
            id: 'total',
            label: 'Total Leads',
            value: stats.totalLeads,
            icon: Users,
            variant: 'mint',
            info: 'Total leads visible in your scope.',
            onClick: clearStatFilters,
            active: !statFilter,
          },
          {
            id: 'meaningful',
            label: 'Meaningful Connect',
            value: meaningfulConnectCount,
            icon: MessageSquare,
            variant: 'rose',
            info: 'Leads with a meaningful connection (YES).',
            onClick: toggleMeaningfulStatFilter,
            active: statFilter === 'meaningful',
          },
          {
            id: 'converted',
            label: 'Converted',
            value: stats.convertedLeads,
            icon: CheckCircle2,
            variant: 'apricot',
            info: 'Leads converted into paying customers.',
            onClick: toggleConvertedStatFilter,
            active: statFilter === 'converted',
          },
          {
            id: 'rate',
            label: 'Success Rate',
            value: `${Number(stats.conversionRate).toFixed(1)}%`,
            icon: Target,
            variant: 'info',
            info: 'Converted leads divided by total leads.',
          },
        ],
       
      }}
      toolbarActions={
        <>
          {artistMode && <ArtistCrmImportPanel compact />}
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={14} /> {artistMode ? 'Add Contact' : 'Add Lead'}
          </Button>
        </>
      }
      toolbar={
        <>
          <SearchInput
            label="Search"
            placeholder={artistMode ? 'Search contacts…' : 'Search name or phone...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {artistMode ? (
            <>
              <NexusDropdown
                label="Project"
                placeholder="Artist"
                options={[
                  { value: 'all', label: 'All Artists' },
                  { value: 'YUGM', label: 'YUGM' },
                  { value: 'Harshad Duhita', label: 'Harshad Duhita' },
                  { value: 'shared', label: 'Shared Event DB' },
                ]}
                value={filters.artistProject || 'all'}
                onChange={(v) => setFilters({ ...filters, artistProject: v })}
              />
              <NexusDropdown
                label="Category"
                placeholder="Category"
                options={[
                  { value: 'all', label: 'All Categories' },
                  { value: 'press_media', label: 'Press / Media' },
                  { value: 'event_organizer', label: 'Event Organizer' },
                  { value: 'event_database', label: 'Event Database' },
                ]}
                value={filters.contactCategory || 'all'}
                onChange={(v) => setFilters({ ...filters, contactCategory: v })}
              />
              <NexusDropdown
                label="Email"
                placeholder="Email status"
                options={[
                  { value: 'all', label: 'All Email Status' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Invalid', label: 'Invalid' },
                  { value: 'Unsubscribed', label: 'Unsubscribed' },
                ]}
                value={filters.emailStatus || 'all'}
                onChange={(v) => setFilters({ ...filters, emailStatus: v })}
              />
            </>
          ) : (
            <>
          <NexusDropdown
            label="Interest"
            placeholder="Interest Level"
            options={[{ value: 'all', label: 'All Interest Levels' }, ...leadStatusesList.map((s) => ({ value: s, label: s }))]}
            value={filters.leadStatus}
            onChange={(v) => {
              setStatFilter(null);
              setFilters({ ...filters, leadStatus: v, warmPipeline: false });
            }}
          />
          <NexusDropdown
            label="Meaningful Connect"
            placeholder="Meaningful Connect"
            options={[{ value: 'all', label: 'All' }, ...meaningfulConnectList.map((s) => ({ value: s, label: s }))]}
            value={filters.meaningfulConnect}
            onChange={(v) => {
              setStatFilter(v === 'YES' ? 'meaningful' : null);
              setFilters({ ...filters, meaningfulConnect: v, warmPipeline: false });
            }}
          />
          <NexusDropdown
            label="Source"
            placeholder="Source"
            options={[{ value: 'all', label: 'All Sources' }, ...sourcesList.map((s) => ({ value: s, label: s }))]}
            value={filters.source}
            onChange={(v) => setFilters({ ...filters, source: v })}
          />
          <NexusDropdown
            label="Quality"
            placeholder="Quality"
            options={[{ value: 'all', label: 'All Quality' }, ...qualitiesList.map((q) => ({ value: q, label: `Level ${q}` }))]}
            value={filters.leadQuality}
            onChange={(v) => setFilters({ ...filters, leadQuality: v })}
          />
          <NexusDropdown
            label="Agent"
            placeholder="Agent"
            options={[{ value: 'all', label: 'All Agents' }, { value: 'unassigned', label: 'Unassigned' }, ...team.map((r) => ({ value: r._id, label: r.name }))]}
            value={filters.assignedRepId}
            onChange={(v) => setFilters({ ...filters, assignedRepId: v })}
          />
            </>
          )}
        </>
      }
    >
      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load leads')}
          onRetry={() => refetch()}
        />
      )}
      {artistMode && <ArtistCrmImportPanel />}
      <DataTable
        columns={columns}
        data={leads}
        onRowClick={(row) => setSelectedLead(row)}
        paginated
        serverSide
        totalItems={totalLeads}
        totalPages={totalPages}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        sortState={tableSortState}
        onSortChange={handleTableSortChange}
        isLoading={isLoading}
        rowEstimateSize={58}
        tableMaxHeight="70vh"
      />

      <FullScreenWorkspace
        isOpen={!!selectedLead}
        onClose={() => closeLeadEditor(selectedLead?._id, setSelectedLead)}
        title={selectedLead?.name || 'Customer Details'}
        subtitle={selectedLead ? `ref: ${selectedLead._id?.substring(0, 8) || '—'}` : ''}
        onSave={handleSaveLead}
        onCancel={handleRevertLeadEdits}
        hasChanges={hasLeadChanges}
        isSaving={updateMutation.isPending}
        saveDisabled={Object.keys(fieldErrors).length > 0}
        centerMain={false}
        mainClassName="w-full max-w-4xl"
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
                  closeLeadEditor(selectedLead._id, setSelectedLead);
                } catch (err) {
                  if (err.response?.status === 423) {
                    toast.error(formatLockToast(err));
                    return;
                  }
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
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)] border-[var(--color-bg-border)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                <UserCheck size={12} className="text-[var(--color-action-primary)]" /> Contact Profile
              </h4>
              <div className="space-y-3">
                <Input
                  label="Customer Name"
                  value={editLeadData.name}
                  error={fieldErrors.name}
                  onChange={(e) => patchEditLeadData({ name: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={editLeadData.email || ''}
                  error={fieldErrors.email}
                  onChange={(e) => patchEditLeadData({ email: e.target.value })}
                  icon={Mail}
                  placeholder="name@example.com"
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
                  onChange={(e) => patchEditLeadData({ city: e.target.value })}
                  icon={MapPin}
                />
                <Input
                  label="Original Lead Source"
                  defaultValue={selectedLead?.source || 'Direct'}
                  icon={Globe}
                  readOnly
                />
                {isArtistBookingEnquiry(selectedLead) && (
                  <div className="pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">Enquiry type</span>
                    <p className="text-xs font-bold mt-1">Website artist booking</p>
                  </div>
                )}
                {artistMode && selectedLead?.contactCategory && !isArtistBookingEnquiry(selectedLead) && (
                  <div className="pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">Category</span>
                    <p className="text-xs font-bold mt-1 capitalize">{selectedLead.contactCategory.replace(/_/g, ' ')}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-3 bg-[var(--color-bg-primary)] border-[var(--color-bg-border)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                {artistRepContext ? 'Assigned Manager' : 'Assigned Agent'}
              </h4>
              <select
                className={CRM_FIELD_SELECT}
                value={editLeadData.assignedRepId || ''}
                onChange={(e) => setEditLeadData({ ...editLeadData, assignedRepId: e.target.value || undefined })}
              >
                <option value="" disabled>Pending Assignment</option>
                {team.map((rep) => (
                  <option key={rep._id} value={rep._id}>{rep.name}</option>
                ))}
              </select>
              {selectedLead?.assignedRep && (
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center overflow-hidden shrink-0">
                    {selectedLead.assignedRep.avatar ? (
                      <img src={selectedLead.assignedRep.avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                    ) : (
                      <Users size={16} className="text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Currently <span className="font-bold text-[var(--color-text-primary)]">{selectedLead.assignedRep.name}</span>
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-3 bg-[var(--color-bg-primary)] border-[var(--color-bg-border)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Pipeline Snapshot</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant={editLeadData.leadStatus === 'Converted' ? 'mint' : 'info'}>
                  {(editLeadData.leadStatus || 'New').toUpperCase()}
                </Badge>
                <Badge variant="neutral">{(editLeadData.callStatus || 'Pending').toUpperCase()}</Badge>
                <Badge variant={meaningfulConnectBadgeVariant(editLeadData.meaningfulConnect)}>
                  MC: {formatMeaningfulConnect(editLeadData.meaningfulConnect).toUpperCase()}
                </Badge>
                <Badge variant="slate">Q{editLeadData.leadQuality || '—'}</Badge>
              </div>
              {selectedLead?.unsubscribed && (
                <Badge variant="rose" className="w-fit">Unsubscribed</Badge>
              )}
              {editLeadData.nextFollowupDate && (
                <p className="text-[10px] font-mono text-blue-400 flex items-center gap-1.5 pt-1 border-t border-[var(--color-bg-border)]">
                  <Clock size={12} />
                  Follow-up {editLeadData.nextFollowupDate} {editLeadData.nextFollowupTime}
                </p>
              )}
            </Card>

            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)] border-[var(--color-bg-border)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5 border-b border-[var(--color-bg-border)] pb-2">
                <Zap size={12} className="text-purple-500" /> Exly Offerings
              </h4>
              <div className="space-y-3">
                {(() => {
                  const offerings = detailLead?.exlyOfferings?.length > 0
                    ? detailLead.exlyOfferings
                    : detailLead?.exlyOfferingTitle ? [{ title: detailLead.exlyOfferingTitle, purchasedAt: detailLead.createdAt }] : [];

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
          <ArtistBookingEnquiryPanel lead={detailLead} />
          <LeadArtistJourneySection lead={detailLead} />
          {/* Lead Stages & Interaction Updates */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
              <Briefcase size={14} /> Mission & Pipeline Status
            </h3>
            <div className="space-y-4">
              <Card className="p-5 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Engagement</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Lead Funnel Stage</label>
                    <select
                      className={CRM_FIELD_SELECT}
                      value={editLeadData.leadStatus}
                      onChange={(e) => setEditLeadData({ ...editLeadData, leadStatus: e.target.value })}
                    >
                      {leadStatusesList.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Call Outcome</label>
                    <select
                      className={CRM_FIELD_SELECT}
                      value={editLeadData.callStatus}
                      onChange={(e) => setEditLeadData({ ...editLeadData, callStatus: e.target.value })}
                    >
                      {callStatusesList.map((cs) => <option key={cs} value={cs}>{cs}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]"
                      title="Manual flag — top stat counts Yes only, not auto from Connected"
                    >
                      Meaningful Connect
                    </label>
                    <select
                      className={CRM_FIELD_SELECT}
                      value={editLeadData.meaningfulConnect || 'PENDING'}
                      onChange={(e) => setEditLeadData({ ...editLeadData, meaningfulConnect: e.target.value })}
                    >
                      {(meaningfulConnectList.length ? meaningfulConnectList : MEANINGFUL_CONNECT_OPTIONS.map((o) => o.value)).map((status) => {
                        const option = MEANINGFUL_CONNECT_OPTIONS.find((o) => o.value === status);
                        return (
                          <option key={status} value={status}>
                            {option?.label || status}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </Card>
              <Card className="p-5 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Qualification</p>
                <div className="max-w-xs">
                  <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">Lead Quality Score</label>
                  <select
                    className={`${CRM_FIELD_SELECT} mt-1.5`}
                    value={editLeadData.leadQuality}
                    onChange={(e) => setEditLeadData({ ...editLeadData, leadQuality: e.target.value })}
                  >
                    {qualitiesList.map((q) => <option key={q} value={q}>Level {q}</option>)}
                  </select>
                </div>
              </Card>
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
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
              value={newLeadData.leadStatus}
              onChange={e => setNewLeadData({ ...newLeadData, leadStatus: e.target.value })}
            >
              {leadStatusesList.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Lead Quality Score</label>
            <select
              className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none"
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
            multiline
            rows={3}
            autoGrow
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
    </ListPageLayout>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
