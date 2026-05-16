import React, { useState, useMemo } from 'react';
import {
  Search, RefreshCw, Clock, Target, Zap, CheckCircle2, AlertCircle, PhoneCall, Calendar, Edit2, Users
} from 'lucide-react';
import { 
  Badge, 
  PageHeader, 
  Card, 
  PageContainer, 
  DataTable, 
  Button, 
  Input, 
  TabSwitcher,
  StatCard,
  PageSkeleton,
  FullScreenWorkspace
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveLeads } from '../../hooks/useTaskmasterQueries';
import { format, isPast, isToday, isFuture, isValid } from 'date-fns';

export default function FollowupsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('today');
  const [selectedLead, setSelectedLead] = useState(null);

  const { data, isLoading, refetch } = useLiveLeads({
    limit: 1000,
    hasFollowup: 'true',
    assignedRepId: user?.role === 'admin' ? undefined : user?._id
  });

  const leads = data?.leads || [];

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
    return processedLeads.filter(lead => {
      const date = lead.followupFullDate;
      if (activeTab === 'today') return isToday(date);
      if (activeTab === 'overdue') return isPast(date) && !isToday(date);
      if (activeTab === 'upcoming') return isFuture(date);
      return true;
    }).sort((a, b) => a.followupFullDate - b.followupFullDate);
  }, [processedLeads, activeTab]);

  const stats = useMemo(() => {
    const counts = { today: 0, overdue: 0, upcoming: 0 };
    processedLeads.forEach(lead => {
      const date = lead.followupFullDate;
      if (isToday(date)) counts.today++;
      else if (isPast(date)) counts.overdue++;
      else if (isFuture(date)) counts.upcoming++;
    });
    return counts;
  }, [processedLeads]);

  const columns = [
    {
      header: 'Customer Details',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs tracking-tight">{row.name}</span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{row.phone}</span>
        </div>
      )
    },
    {
      header: 'Planned Time',
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
      render: (row) => (
        <Badge variant={row.leadStatus === 'Hot' ? 'danger' : row.leadStatus === 'Warm' ? 'warning' : 'info'}>
          {row.leadStatus}
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

  if (isLoading && leads.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Follow-up Schedule"
        subtitle="Stay organized with your planned calls and customer interactions."
        icon={PhoneCall}
        actions={
          <div className="flex items-center gap-2">
            <TabSwitcher
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'today', label: `Today (${stats.today})` },
                { id: 'overdue', label: `Overdue (${stats.overdue})` },
                { id: 'upcoming', label: `Upcoming (${stats.upcoming})` }
              ]}
            />
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Calls Today" value={stats.today} icon={PhoneCall} variant="info" info="Interactions planned for the current day." />
        <StatCard label="Overdue Tasks" value={stats.overdue} icon={AlertCircle} variant="rose" info="Scheduled calls that were missed." />
        <StatCard label="Next Commitments" value={stats.upcoming} icon={Calendar} variant="mint" info="Future interactions scheduled in your pipeline." />
        <StatCard label="Daily Goal" value="92%" icon={CheckCircle2} variant="slate" info="The percentage of today's calls you have finished." />
      </div>

      <Card className="p-0 overflow-hidden border border-[var(--color-bg-border)]">
        <DataTable
          columns={columns}
          data={filteredLeads}
          onRowClick={(row) => setSelectedLead(row)}
        />
        {filteredLeads.length === 0 && (
          <div className="p-20 text-center opacity-30">
            <PhoneCall size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No planned calls in this group</p>
          </div>
        )}
      </Card>

      <FullScreenWorkspace
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.name || 'Customer Details'}
        subtitle={`Scheduled for: ${selectedLead?.followupFullDate ? format(selectedLead.followupFullDate, 'PPp') : 'Unscheduled'}`}
        onSave={() => setSelectedLead(null)}
        sidebar={
          <div className="space-y-4">
             <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Record Context</h4>
                <div className="space-y-3">
                   <div className="flex justify-between">
                      <span className="text-[10px] font-bold">Mission Status</span>
                      <Badge variant="info">{selectedLead?.leadStatus || 'Fresh'}</Badge>
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
                      <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-tight">Sales Representative</p>
                   </div>
                </div>
             </Card>
          </div>
        }
      >
        <div className="space-y-8">
           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Target size={14} /> Interaction Notes
              </h3>
              <div className="p-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-bg-border)]">
                 <p className="text-sm font-medium leading-relaxed">
                   {selectedLead?.remarks || 'No specific instructions recorded for this interaction.'}
                 </p>
              </div>
           </section>

           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Edit2 size={14} /> Update Customer Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input label="Customer Name" defaultValue={selectedLead?.name} />
                 <Input label="Phone Number" defaultValue={selectedLead?.phone} />
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Planned Date</label>
                    <input 
                      type="date" 
                      defaultValue={selectedLead?.nextFollowupDate}
                      className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Planned Time</label>
                    <input 
                      type="time" 
                      defaultValue={selectedLead?.nextFollowupTime}
                      className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                    />
                 </div>
              </div>
           </section>
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
}
