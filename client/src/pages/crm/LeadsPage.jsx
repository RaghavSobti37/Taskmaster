import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Download, Plus, ChevronLeft, ChevronRight,
  Database, TrendingUp, UserCheck, Briefcase, Users, Zap, Target, Clock, MapPin, Globe
} from 'lucide-react';
import { 
  Badge, 
  PageHeader, 
  Card, 
  PageContainer, 
  DataTable, 
  Button, 
  TabSwitcher,
  StatCard,
  PageSkeleton,
  FullScreenWorkspace,
  Input,
  NexusDropdown
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveLeads, useUserDirectory, useCRMStats } from '../../hooks/useTaskmasterQueries';

export default function LeadsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  const [filters, setFilters] = useState({
    leadQuality: 'all',
    callStatus: 'all',
    leadStatus: 'all',
    assignedRepId: 'all',
    artistType: 'all',
    primaryRole: 'all'
  });

  const queryParams = useMemo(() => ({
    page,
    limit: pageSize,
    search: searchTerm,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== 'all')),
    ...(activeTab === 'fresh' ? { leadStatus: 'Fresh' } : {}),
    ...(activeTab === 'contacted' ? { leadStatus: 'Contacted' } : {})
  }), [page, pageSize, searchTerm, filters, activeTab]);

  const { data, isLoading } = useLiveLeads(queryParams);
  const { data: statsData } = useCRMStats();
  const { data: team = [] } = useUserDirectory();

  const leads = data?.leads || [];
  const totalLeads = data?.total || 0;
  const totalPages = data?.pages || 1;

  const getRepName = (id) => team.find(r => r._id === id)?.name || 'Unknown';

  const columns = [
    {
      header: 'Customer Details',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs tracking-tight">{row.name}</span>
            {row.artistType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] font-normal tracking-tight">
                {row.artistType.replace(' Artiste', '')}
              </span>
            )}
            {row.primaryRole && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-action-primary)]/10 border border-[var(--color-action-primary)]/20 text-[var(--color-action-primary)] font-normal tracking-tight">
                {row.primaryRole}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{row.email} {row.phone ? `• ${row.phone}` : ''} {row.city ? `• ${row.city}` : ''}</span>
        </div>
      )
    },
    {
      header: 'Quality Score',
      info: 'How likely this person is to join based on their recent interactions.',
      render: (row) => (
        <Badge variant={row.leadQuality >= 4 ? 'mint' : row.leadQuality >= 2 ? 'info' : 'apricot'}>
          LEVEL {row.leadQuality}
        </Badge>
      )
    },
    {
      header: 'Mission Status',
      render: (row) => (
        <Badge variant={row.leadStatus === 'Converted' ? 'mint' : 'slate'}>
          {row.leadStatus?.toUpperCase()}
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
          <span className="text-[10px] font-black uppercase tracking-tight truncate">{row.assignedRep?.name || 'Unassigned'}</span>
        </div>
      )
    }
  ];

  if (isLoading && page === 1) return <PageSkeleton />;

  const stats = statsData || { totalLeads: 0, convertedLeads: 0, conversionRate: 0, activeReach: 0 };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Customer Leads"
        subtitle="Manage and track potential members in your sales pipeline."
        icon={Database}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => {}}>
              <Download size={14} /> Export List
            </Button>
            <Button size="sm">
              <Plus size={14} /> Add Lead
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats.totalLeads} icon={Users} variant="slate" />
        <StatCard label="Active Reach" value={stats.activeReach} icon={Zap} variant="info" />
        <StatCard label="Joined" value={stats.convertedLeads} icon={TrendingUp} variant="mint" />
        <StatCard label="Success Rate" value={`${stats.conversionRate}%`} icon={Target} variant="apricot" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <TabSwitcher
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'all', label: 'All Leads' },
                { id: 'fresh', label: 'Fresh' },
                { id: 'contacted', label: 'In Progress' }
              ]}
            />
          </div>
          <div className="flex items-center gap-3">
             <div className="w-64">
               <Input 
                 placeholder="Search by name or phone..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 icon={Search}
               />
             </div>
             <div className="w-32">
               <NexusDropdown 
                 placeholder="Quality"
                 options={[
                   { value: 'all', label: 'All Quality' },
                   { value: '5', label: 'Level 5' },
                   { value: '4', label: 'Level 4' },
                   { value: '3', label: 'Level 3' },
                   { value: '2', label: 'Level 2' },
                   { value: '1', label: 'Level 1' }
                 ]}
                 value={filters.leadQuality}
                 onChange={v => setFilters({...filters, leadQuality: v})}
               />
             </div>
             <div className="w-36">
               <NexusDropdown 
                 placeholder="Artist Type"
                 options={[
                   { value: 'all', label: 'All Artists' },
                   { value: 'Full-time Artiste', label: 'Full-time' },
                   { value: 'Part Time Artiste', label: 'Part-time' },
                   { value: 'Hobbyist', label: 'Hobbyist' }
                 ]}
                 value={filters.artistType || 'all'}
                 onChange={v => setFilters({...filters, artistType: v})}
               />
             </div>
             <div className="w-36">
               <NexusDropdown 
                 placeholder="Role"
                 options={[
                   { value: 'all', label: 'All Roles' },
                   { value: 'Vocalist', label: 'Vocalist' },
                   { value: 'Music Producer', label: 'Producer' },
                   { value: 'Singer Songwriter', label: 'Songwriter' },
                   { value: 'Instrumentalist', label: 'Instrumentalist' },
                   { value: 'Composer', label: 'Composer' }
                 ]}
                 value={filters.primaryRole || 'all'}
                 onChange={v => setFilters({...filters, primaryRole: v})}
               />
             </div>
             <div className="w-40">
               <NexusDropdown 
                 placeholder="Agent"
                 options={[{ value: 'all', label: 'All Agents' }, ...team.map(r => ({ value: r._id, label: r.name }))]}
                 value={filters.assignedRepId}
                 onChange={v => setFilters({...filters, assignedRepId: v})}
               />
             </div>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <DataTable
            columns={columns}
            data={leads}
            onRowClick={(row) => setSelectedLead(row)}
          />
        </Card>

        <div className="flex items-center justify-between pt-4">
           <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">
             Showing {leads.length} of {totalLeads} leads
           </p>
           <div className="flex items-center gap-2">
              <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={12} /></Button>
              <span className="text-[10px] font-black px-2">{page} / {totalPages}</span>
              <Button variant="secondary" size="xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={12} /></Button>
           </div>
        </div>
      </div>

      <FullScreenWorkspace
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.name || 'Customer Details'}
        subtitle={`ID: ${selectedLead?._id?.substring(0, 8)} • Source: ${selectedLead?.source || 'Direct'}`}
        onSave={() => setSelectedLead(null)}
        sidebar={
          <div className="space-y-4">
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Current Status</h4>
               <div className="space-y-3">
                  <div className="flex justify-between">
                     <span className="text-[10px] font-bold">Progress</span>
                     <Badge variant={selectedLead?.leadStatus === 'Converted' ? 'success' : 'info'}>{selectedLead?.leadStatus || 'Fresh'}</Badge>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-[10px] font-bold">Call History</span>
                     <Badge variant="neutral">{selectedLead?.callStatus || 'No Record'}</Badge>
                  </div>
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
          </div>
        }
      >
        <div className="space-y-8">
           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <UserCheck size={14} /> Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-6">
                 <Input label="Customer Name" defaultValue={selectedLead?.name} />
                 <Input label="Phone Number" defaultValue={selectedLead?.phone} />
                 <Input label="Location" defaultValue={selectedLead?.city || 'Not Specified'} icon={MapPin} />
                 <Input label="Original Source" defaultValue={selectedLead?.source || 'Direct'} icon={Globe} readOnly />
              </div>
           </section>

           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Briefcase size={14} /> Interaction Details
              </h3>
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Interest Level</label>
                    <select 
                      className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                      defaultValue={selectedLead?.leadQuality}
                    >
                       {[1, 2, 3, 4, 5].map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Planned Action</label>
                    <Input placeholder="E.g., Call tomorrow" icon={Clock} />
                 </div>
              </div>
           </section>
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
}
