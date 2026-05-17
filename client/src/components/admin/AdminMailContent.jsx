import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, Upload, Plus, Play, CheckCircle2, AlertCircle, FileCode, Users, Trash2, Zap, BarChart2, RefreshCw, Send, Check, Search, Filter, X, UserMinus
} from 'lucide-react';
import { 
  Card, Button, Input, Badge, DataTable, StatCard, PageSkeleton, TabSwitcher, NexusDropdown 
} from '../ui';
import { 
  useMailProfiles, useMailCampaigns, useMailStats, useCreateMailProfile, 
  useDeleteMailProfile, useCreateCampaign, useSendCampaign, useLiveLeads, useUserDirectory, useScanBounces, useCumulativeAnalytics 
} from '../../hooks/useTaskmasterQueries';
import { format } from 'date-fns';
import CsvImporter from '../CsvImporter';

export default function AdminMailContent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profiles = [], isLoading: profilesLoading, refetch: refetchProfiles } = useMailProfiles();
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useMailCampaigns();
  const { data: stats, refetch: refetchStats } = useMailStats();
  const { data: team = [] } = useUserDirectory();
  const { data: cumulativeAnalytics } = useCumulativeAnalytics();

  // Filter state for CRM leads
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    leadQuality: 'all',
    callStatus: 'all',
    leadStatus: 'all',
    assignedRepId: 'all',
    artistType: 'all',
    primaryRole: 'all'
  });

  const queryParams = useMemo(() => ({
    limit: 1000,
    hasEmail: 'true',
    search: searchTerm,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== 'all')),
    ...(activeTab === 'fresh' ? { leadStatus: 'Fresh' } : {}),
    ...(activeTab === 'contacted' ? { leadStatus: 'Contacted' } : {})
  }), [searchTerm, filters, activeTab]);

  const { data: leadsData, isLoading: leadsLoading } = useLiveLeads(queryParams);
  const leads = leadsData?.leads || [];
  const totalLeads = leadsData?.total || 0;

  const createProfileMutation = useCreateMailProfile();
  const deleteProfileMutation = useDeleteMailProfile();
  const createCampaignMutation = useCreateCampaign();
  const sendCampaignMutation = useSendCampaign();
  const scanBouncesMutation = useScanBounces();

  // Navigation within Mail tab
  const [mode, setMode] = useState('campaigns'); // 'campaigns', 'new_campaign', 'profiles'
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // New Profile State
  const [newProfile, setNewProfile] = useState({
    name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: ''
  });

  // New Campaign State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [senderProfileId, setSenderProfileId] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [htmlFileName, setHtmlFileName] = useState('');

  // Handle HTML File Upload
  const handleHtmlUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setHtmlFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target.result);
    };
    reader.readAsText(file);
  };

  // Handle CSV File Upload
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) return;

      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIdx = header.findIndex(h => h.includes('email'));
      const nameIdx = header.findIndex(h => h.includes('name'));

      if (emailIdx === -1) {
        alert('Could not detect "email" column in CSV header.');
        return;
      }

      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const email = parts[emailIdx];
        const name = nameIdx !== -1 ? parts[nameIdx] : '';
        if (email && email.includes('@')) {
          parsed.push({ name, email });
        }
      }
      setCsvRecipients(parsed);
    };
    reader.readAsText(file);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newProfile.name || !newProfile.email || !newProfile.smtpHost || !newProfile.smtpUser || !newProfile.smtpPass) {
      alert('Please fill in all SMTP fields');
      return;
    }
    await createProfileMutation.mutateAsync(newProfile);
    setNewProfile({ name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' });
  };

  const handleCreateCampaign = async () => {
    if (!title || !subject || !content || !senderProfileId) {
      alert('Please complete campaign title, subject, content, and select a sender profile.');
      return;
    }
    if (selectedLeadIds.length === 0 && csvRecipients.length === 0) {
      alert('Please select CRM leads or upload a recipient CSV.');
      return;
    }

    await createCampaignMutation.mutateAsync({
      title,
      subject,
      content,
      senderProfileId,
      leadIds: selectedLeadIds,
      customRecipients: csvRecipients
    });

    setTitle('');
    setSubject('');
    setContent('');
    setSelectedLeadIds([]);
    setCsvRecipients([]);
    setCsvFileName('');
    setHtmlFileName('');
    setMode('campaigns');
  };

  const handleLoadReminderTemplate = () => {
    setTitle('Shakti Session Reminder');
    setSubject('Your Upcoming Session Alignment • The Shakti Collective');
    setContent(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Reminder: The Shakti Collective</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F1F5F9; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B0F19; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #111827; border: 1px solid #1F2937; border-radius: 24px; padding: 48px 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <tr>
            <td align="center" style="padding-bottom: 32px; border-bottom: 1px solid #1F2937;">
              <h1 style="font-size: 28px; font-weight: 800; color: #38BDF8; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">The Shakti Collective</h1>
              <p style="font-size: 14px; font-weight: 600; color: #94A3B8; margin: 0; text-transform: uppercase; letter-spacing: 4px;">Exclusive Session Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 0 28px 0; font-size: 16px; line-height: 1.6; color: #E2E8F0;">
              <p style="margin: 0 0 20px 0;">Namaste <strong>Valued Member</strong>,</p>
              <p style="margin: 0 0 24px 0;">Your upcoming immersive musical alignment and production session is fast approaching. We are preparing our studio environment for an extraordinary session of creative transcendence.</p>
              
              <div style="background-color: #1E293B; border-left: 4px solid #38BDF8; padding: 20px 24px; border-radius: 12px; margin-bottom: 32px;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #94A3B8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Session Details</p>
                <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #F8FAFC;">Shakti Studio Alignment</p>
                <p style="margin: 0; font-size: 14px; color: #CBD5E1;">Date: Tomorrow @ 4:00 PM IST | Location: Main Acoustic Hall</p>
              </div>

              <p style="margin: 0 0 36px 0; text-align: center;">Please confirm your attendance or review session prerequisites on our official collective portal.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <a href="https://theshakticollective.in" style="display: inline-block; background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); color: #FFFFFF; font-size: 16px; font-weight: 700; text-decoration: none; padding: 18px 40px; border-radius: 16px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.5);">Access Collective Portal</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top: 1px solid #1F2937; padding-top: 24px; font-size: 12px; color: #64748B;">
              <p style="margin: 0;">The Shakti Collective • Elevating Indigenously Rooted Music</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`);
  };

  const campaignColumns = [
    {
      header: 'Campaign Information',
      render: (row) => (
        <div>
          <span className="font-bold text-xs tracking-tight">{row.title}</span>
          <span className="text-[10px] text-[var(--color-text-muted)] block font-mono">{row.subject}</span>
        </div>
      )
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'Completed' ? 'success' : row.status === 'Sending' ? 'warning' : 'info'}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Recipients & Delivery',
      render: (row) => (
        <div className="flex items-center gap-4">
          <div className="text-[11px] font-bold">
            {row.stats?.total || 0} Target
          </div>
          <div className="text-[11px] font-bold text-emerald-500">
            {row.stats?.sent || 0} Sent
          </div>
        </div>
      )
    },
    {
      header: 'Created',
      render: (row) => (
        <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">
          {format(new Date(row.createdAt), 'MMM dd, yyyy')}
        </span>
      )
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'Draft' && (
            <Button 
              size="sm" 
              variant="primary" 
              onClick={(e) => { e.stopPropagation(); sendCampaignMutation.mutate(row._id); }}
              disabled={sendCampaignMutation.isPending}
            >
              <Play size={12} /> Dispatch Now
            </Button>
          )}
        </div>
      )
    }
  ];

  if (profilesLoading && campaignsLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-2">
          <Button 
            variant={mode === 'campaigns' ? 'primary' : 'secondary'} 
            size="sm" 
            onClick={() => setMode('campaigns')}
          >
            <BarChart2 size={14} /> Campaigns ({campaigns.length})
          </Button>
          <Button 
            variant={mode === 'new_campaign' ? 'primary' : 'secondary'} 
            size="sm" 
            onClick={() => setMode('new_campaign')}
          >
            <Plus size={14} /> Create Campaign
          </Button>
          <Button 
            variant={mode === 'csv_import' ? 'primary' : 'secondary'} 
            size="sm" 
            onClick={() => setMode('csv_import')}
          >
            <Upload size={14} /> Import Leads CSV
          </Button>
          <Button 
            variant={mode === 'analytics' ? 'primary' : 'secondary'} 
            size="sm" 
            onClick={() => setMode('analytics')}
          >
            <BarChart2 size={14} /> Aggregate Analytics
          </Button>
          <Button 
            variant={mode === 'profiles' ? 'primary' : 'secondary'} 
            size="sm" 
            onClick={() => setMode('profiles')}
          >
            <Zap size={14} /> SMTP Profiles ({profiles.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { refetchStats(); refetchCampaigns(); refetchProfiles(); queryClient.invalidateQueries({ queryKey: ['mail'] }); }}>
            <RefreshCw size={14} /> Refresh Stats
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => {
              if (profiles.length === 0) {
                alert('Please configure an SMTP Profile first');
                return;
              }
              scanBouncesMutation.mutate(profiles[0]?._id);
            }} 
            disabled={scanBouncesMutation.isPending || profiles.length === 0}
          >
            <RefreshCw size={14} className={scanBouncesMutation.isPending ? 'animate-spin' : ''} /> Scan Bounces
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <StatCard label="Total Campaigns" value={stats?.totalCampaigns || campaigns.length} icon={Mail} variant="info" />
        <StatCard label="Emails Dispatched" value={stats?.totalSent || 0} icon={Send} variant="mint" />
        <StatCard label="Bounced / Failed" value={stats?.totalBounced || 0} icon={AlertCircle} variant="rose" />
        <StatCard label="Opens Tracked" value={stats?.totalOpened || 0} icon={CheckCircle2} variant="slate" />
        <StatCard label="Unsubscribed" value={stats?.totalUnsubscribed || 0} icon={UserMinus} variant="warning" />
      </div>

      {/* Mode: Campaigns List */}
      {mode === 'campaigns' && (
        <Card className="p-0 overflow-hidden border border-[var(--color-bg-border)]">
          <DataTable columns={campaignColumns} data={campaigns} onRowClick={(row) => navigate(`/campaign/${row.campaignId || row._id}`)} />
          {campaigns.length === 0 && (
            <div className="p-16 text-center opacity-30">
              <Mail size={48} className="mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">No campaigns created yet</p>
            </div>
          )}
        </Card>
      )}

      {/* Mode: New Campaign Builder */}
      {mode === 'new_campaign' && (
        <Card className="p-6 space-y-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
          <div className="flex items-center justify-between">
             <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
               <Mail size={16} /> Campaign Architect
             </h3>
             <Button size="xs" variant="primary" onClick={handleLoadReminderTemplate}>
               ⚡ Load Session Reminder Template
             </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Input label="Campaign Title" placeholder="e.g. May Product Release" value={title} onChange={e => setTitle(e.target.value)} />
             <Input label="Email Subject Line" placeholder="e.g. Unlocking Next-Gen Capabilities" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Sender Profile (SMTP)</label>
             {profiles.length === 0 ? (
               <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                 <span className="text-xs text-amber-500 font-bold">No SMTP Profiles configured. Please configure a profile first.</span>
                 <Button size="sm" onClick={() => setMode('profiles')}>Configure Profile</Button>
               </div>
             ) : (
               <select 
                 value={senderProfileId} 
                 onChange={e => setSenderProfileId(e.target.value)}
                 className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
               >
                 <option value="">-- Select Sender Profile --</option>
                 {profiles.map(p => (
                   <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
                 ))}
               </select>
             )}
          </div>

          {/* HTML Content & Template Upload */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
               <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Email Content (HTML)</label>
               <div className="flex items-center gap-2">
                 <Button size="xs" variant="secondary" onClick={handleLoadReminderTemplate}>
                   ⚡ Use Session Reminder Template
                 </Button>
                 <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase hover:border-[var(--color-action-primary)] transition-all">
                   <Upload size={12} /> {htmlFileName ? htmlFileName : 'Upload HTML File'}
                   <input type="file" accept=".html,.htm" className="hidden" onChange={handleHtmlUpload} />
                 </label>
               </div>
             </div>
             <textarea 
               rows={8} 
               value={content} 
               onChange={e => setContent(e.target.value)}
               placeholder="<h1>Hello {{name}}</h1><p>Check out our latest update...</p>"
               className="w-full p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl text-xs font-mono outline-none focus:border-[var(--color-action-primary)] transition-all"
             />
          </div>

          {/* Recipients Selector */}
          <div className="space-y-4">
             <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
               <Users size={14} /> Target Audience ({selectedLeadIds.length + csvRecipients.length} Selected)
             </h4>

             <div className="space-y-4">
               {/* CSV Upload Card & Preview */}
               <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-bold uppercase tracking-tight">CSV Direct Upload</span>
                   <div className="flex items-center gap-2">
                     {csvRecipients.length > 0 && (
                       <button 
                         type="button"
                         onClick={() => { setCsvRecipients([]); setCsvFileName(''); }}
                         className="text-[10px] text-rose-500 font-bold hover:underline flex items-center gap-1"
                       >
                         <X size={12} /> Clear
                       </button>
                     )}
                     <Badge variant="info">{csvRecipients.length} Loaded</Badge>
                   </div>
                 </div>
                 <p className="text-[10px] text-[var(--color-text-muted)]">Upload a CSV containing "name" and "email" headers for direct mailing.</p>
                 <label className="w-full cursor-pointer flex items-center justify-center gap-2 py-2 bg-[var(--color-bg-primary)] border border-dashed border-[var(--color-bg-border)] rounded-xl text-xs font-bold hover:border-[var(--color-action-primary)] transition-all">
                   <Upload size={14} /> {csvFileName ? csvFileName : 'Select CSV File'}
                   <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                 </label>

                 {/* Top 5 Emails Preview */}
                 {csvRecipients.length > 0 && (
                   <div className="mt-3 space-y-1.5 border-t border-[var(--color-bg-border)] pt-3">
                     <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-bold uppercase">
                       <span>Loaded Preview (Top 5)</span>
                       <span>{Math.min(5, csvRecipients.length)} of {csvRecipients.length}</span>
                     </div>
                     <div className="space-y-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl p-2 max-h-40 overflow-y-auto font-mono">
                       {csvRecipients.slice(0, 5).map((rec, i) => (
                         <div key={i} className="flex items-center justify-between text-[11px] py-1 px-2 hover:bg-[var(--color-bg-secondary)] rounded-md">
                           <span className="font-bold truncate max-w-[140px]">{rec.name || 'No Name'}</span>
                           <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px]">{rec.email}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>

               {/* CRM Leads Selection Card */}
               <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
                 <div className="flex items-center justify-between flex-wrap gap-2">
                   <div className="flex items-center gap-3">
                     <span className="text-xs font-bold uppercase tracking-tight">Select CRM Leads</span>
                     <Badge variant="mint">{selectedLeadIds.length} Selected</Badge>
                     <span className="text-[10px] text-[var(--color-text-muted)]">({totalLeads} Total Available with Email)</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <Button 
                       size="xs" 
                       variant="secondary"
                       type="button"
                       onClick={() => {
                         const filteredIds = leads.map(l => l._id);
                         const newSelected = Array.from(new Set([...selectedLeadIds, ...filteredIds]));
                         setSelectedLeadIds(newSelected);
                       }}
                     >
                       Select All Filtered ({leads.length})
                     </Button>
                     <Button 
                       size="xs" 
                       variant="ghost"
                       type="button"
                       onClick={() => {
                         const filteredSet = new Set(leads.map(l => l._id));
                         setSelectedLeadIds(selectedLeadIds.filter(id => !filteredSet.has(id)));
                       }}
                       className="text-rose-500 hover:bg-rose-500/10"
                     >
                       Deselect All Filtered
                     </Button>
                   </div>
                 </div>

                 {/* Filters Bar */}
                 <div className="flex items-center gap-3 flex-wrap bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                   <TabSwitcher
                     activeTab={activeTab}
                     onChange={setActiveTab}
                     tabs={[
                       { id: 'all', label: 'All' },
                       { id: 'fresh', label: 'Fresh' },
                       { id: 'contacted', label: 'In Progress' }
                     ]}
                   />
                   <div className="w-52">
                     <Input 
                       placeholder="Search name, phone, email..." 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       icon={Search}
                     />
                   </div>
                   <div className="w-36">
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

                 {/* Leads List */}
                 <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border border-[var(--color-bg-border)] rounded-xl p-2 bg-[var(--color-bg-primary)] custom-scrollbar">
                   {leads.length === 0 ? (
                     <div className="p-8 text-center text-xs text-[var(--color-text-muted)] italic font-mono">
                       {leadsLoading ? 'Loading leads...' : 'No CRM leads match the selected filters.'}
                     </div>
                   ) : (
                     leads.map(l => {
                       const isSel = selectedLeadIds.includes(l._id);
                       const repName = team.find(r => r._id === (typeof l.assignedRep === 'object' ? l.assignedRep?._id : l.assignedRep))?.name || l.assignedRep?.name || 'Unassigned';
                       return (
                         <div 
                           key={l._id} 
                           onClick={() => {
                             if (isSel) setSelectedLeadIds(selectedLeadIds.filter(id => id !== l._id));
                             else setSelectedLeadIds([...selectedLeadIds, l._id]);
                           }}
                           className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-all border ${isSel ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/30 text-[var(--color-action-primary)] font-bold' : 'border-transparent hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'}`}
                         >
                           <div className="flex items-center gap-3">
                             <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSel ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}>
                               {isSel && <Check size={12} />}
                             </div>
                             <div>
                               <div className="flex items-center gap-2">
                                 <span className="font-bold">{l.name}</span>
                                 {l.artistType && (
                                   <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] font-normal tracking-tight">
                                     {l.artistType.replace(' Artiste', '')}
                                   </span>
                                 )}
                                 {l.primaryRole && (
                                   <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-action-primary)]/10 border border-[var(--color-action-primary)]/20 text-[var(--color-action-primary)] font-normal tracking-tight">
                                     {l.primaryRole}
                                   </span>
                                 )}
                               </div>
                               <span className="text-[11px] text-[var(--color-text-muted)] font-mono font-normal block">{l.email} {l.phone ? `• ${l.phone}` : ''} {l.city ? `• ${l.city}` : ''}</span>
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                             <Badge variant={l.leadQuality >= 4 ? 'mint' : 'info'}>L{l.leadQuality || 1}</Badge>
                             <Badge variant={l.leadStatus === 'Converted' ? 'mint' : 'slate'}>{l.leadStatus || 'Fresh'}</Badge>
                             <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[80px]">{repName}</span>
                           </div>
                         </div>
                       );
                     })
                   )}
                 </div>
               </div>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-bg-border)]">
             <Button variant="secondary" onClick={() => setMode('campaigns')}>Cancel</Button>
             <Button 
               onClick={handleCreateCampaign} 
               disabled={createCampaignMutation.isPending || (!title || !subject || !content || !senderProfileId || (selectedLeadIds.length === 0 && csvRecipients.length === 0))}
             >
               <Play size={14} /> Save & Create Campaign
             </Button>
          </div>
        </Card>
      )}

      {/* Mode: SMTP Profiles */}
      {mode === 'profiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
             <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
               <Zap size={16} /> Configure SMTP Profile
             </h3>
             <form onSubmit={handleCreateProfile} className="space-y-4">
               <Input label="Profile Name" placeholder="e.g. Master Dispatch" value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} />
               <Input label="Sender Email Address" placeholder="e.g. notifications@company.com" value={newProfile.email} onChange={e => setNewProfile({...newProfile, email: e.target.value})} />
               <Input label="SMTP Host" placeholder="e.g. smtp.sendgrid.net" value={newProfile.smtpHost} onChange={e => setNewProfile({...newProfile, smtpHost: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                 <Input label="SMTP Port" type="number" value={newProfile.smtpPort} onChange={e => setNewProfile({...newProfile, smtpPort: parseInt(e.target.value)})} />
                 <Input label="SMTP Username" value={newProfile.smtpUser} onChange={e => setNewProfile({...newProfile, smtpUser: e.target.value})} />
               </div>
               <Input label="SMTP Password" type="password" value={newProfile.smtpPass} onChange={e => setNewProfile({...newProfile, smtpPass: e.target.value})} />
               <Button type="submit" disabled={createProfileMutation.isPending} className="w-full">
                 <Plus size={14} /> Save SMTP Profile
               </Button>
             </form>
          </Card>

          <div className="space-y-3">
             <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Active Configurations ({profiles.length})</h3>
             {profiles.map(p => (
               <Card key={p._id} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-between">
                  <div>
                    <span className="font-bold uppercase tracking-tight text-xs block">{p.name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.email} • {p.smtpHost}:{p.smtpPort}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-rose-500 hover:bg-rose-500/10"
                    onClick={() => deleteProfileMutation.mutate(p._id)}
                    disabled={deleteProfileMutation.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
               </Card>
             ))}
             {profiles.length === 0 && (
               <div className="p-12 text-center opacity-30 border border-dashed border-[var(--color-bg-border)] rounded-2xl">
                 <Zap size={32} className="mx-auto mb-2" />
                 <p className="text-[10px] font-black uppercase tracking-widest">No profiles configured</p>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Mode: CSV Import */}
      {mode === 'csv_import' && (
        <CsvImporter onImportComplete={() => { alert('Import complete!'); queryClient.invalidateQueries({ queryKey: ['leads'] }); }} />
      )}

      {/* Mode: Cumulative Analytics */}
      {mode === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <BarChart2 size={14} /> Cumulative Campaign Performance (By Event Tag)
            </h3>
            <div className="border border-[var(--color-bg-border)] rounded-xl overflow-x-auto bg-[var(--color-bg-secondary)] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)]">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Event Tag</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Sent</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Opens</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Clicks</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Open Rate</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {(cumulativeAnalytics?.aggregateData || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[var(--color-bg-primary)]/50">
                      <td className="px-4 py-3 font-bold text-[var(--color-action-primary)]">{row.eventTag}</td>
                      <td className="px-4 py-3">{row.totalSent}</td>
                      <td className="px-4 py-3">{row.totalOpens}</td>
                      <td className="px-4 py-3">{row.totalClicks}</td>
                      <td className="px-4 py-3"><Badge variant="mint">{row.openRate}%</Badge></td>
                      <td className="px-4 py-3"><Badge variant="info">{row.ctr}%</Badge></td>
                    </tr>
                  ))}
                  {(!cumulativeAnalytics?.aggregateData || cumulativeAnalytics.aggregateData.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)] italic font-mono">No cumulative campaign analytics recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <Users size={14} /> Engaged Lead Distribution (Location & Artist Type)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(cumulativeAnalytics?.dynamicBreakdown || []).map((item, idx) => (
                <div key={idx} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs block">{item.location}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{item.artistType}</span>
                  </div>
                  <Badge variant="mint">{item.count} Engaged</Badge>
                </div>
              ))}
              {(!cumulativeAnalytics?.dynamicBreakdown || cumulativeAnalytics.dynamicBreakdown.length === 0) && (
                <div className="col-span-3 p-8 text-center text-[var(--color-text-muted)] italic font-mono border border-dashed rounded-xl">No engaged lead demographics recorded yet.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Selected Campaign Detail Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black uppercase tracking-tight">{selectedCampaign.title}</h2>
                  <Badge variant={selectedCampaign.status === 'Completed' ? 'mint' : selectedCampaign.status === 'Sending' ? 'warning' : 'info'}>
                    {selectedCampaign.status}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1">{selectedCampaign.subject}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>
                <X size={18} />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <StatCard label="Total Target" value={selectedCampaign.stats?.total || 0} icon={Users} variant="slate" />
                <StatCard label="Sent Success" value={selectedCampaign.stats?.sent || 0} icon={Send} variant="mint" />
                <StatCard label="Opened" value={selectedCampaign.stats?.opened || 0} icon={CheckCircle2} variant="info" />
                <StatCard label="Clicked" value={selectedCampaign.stats?.clicked || 0} icon={Play} variant="apricot" />
                <StatCard label="Bounced / Fail" value={selectedCampaign.stats?.bounced || 0} icon={AlertCircle} variant="rose" />
                <StatCard label="User Unsub" value={selectedCampaign.stats?.unsubscribed || 0} icon={UserMinus} variant="warning" />
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
                  <Users size={14} /> Campaign Recipient Analytics ({selectedCampaign.recipients?.length || 0})
                </h3>
                <div className="border border-[var(--color-bg-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]">
                  <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                    <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)]">
                      <tr>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Recipient Email</th>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Sent At</th>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Diagnostic Info</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)] font-mono">
                      {selectedCampaign.recipients?.map((r, idx) => (
                        <tr key={r._id || idx} className="hover:bg-[var(--color-bg-primary)]/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{r.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant={r.status === 'Opened' ? 'mint' : r.status === 'Sent' ? 'info' : r.status === 'Unsubscribed' ? 'warning' : r.status === 'Bounced' || r.status === 'Failed' || r.status === 'Invalid' ? 'rose' : 'slate'}>
                              {r.status || 'Pending'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)]">
                            {r.sentAt ? format(new Date(r.sentAt), 'MMM dd, HH:mm:ss') : '—'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)] truncate max-w-xs">
                            {r.error || r.messageId || 'Normal Target Dispatch'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
