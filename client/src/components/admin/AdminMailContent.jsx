import React, { useState, useMemo } from 'react';
import { 
  Mail, Upload, Plus, Play, CheckCircle2, AlertCircle, FileCode, Users, Trash2, Zap, BarChart2, RefreshCw, Send, Check
} from 'lucide-react';
import { 
  Card, Button, Input, Badge, DataTable, StatCard, PageSkeleton 
} from '../ui';
import { 
  useMailProfiles, useMailCampaigns, useMailStats, useCreateMailProfile, 
  useDeleteMailProfile, useCreateCampaign, useSendCampaign, useLiveLeads 
} from '../../hooks/useTaskmasterQueries';
import { format } from 'date-fns';

export default function AdminMailContent() {
  const { data: profiles = [], isLoading: profilesLoading } = useMailProfiles();
  const { data: campaigns = [], isLoading: campaignsLoading } = useMailCampaigns();
  const { data: stats, refetch: refetchStats } = useMailStats();
  const { data: leadsData } = useLiveLeads({ limit: 1000, hasEmail: 'true' });
  const leads = leadsData?.leads || [];

  const createProfileMutation = useCreateMailProfile();
  const deleteProfileMutation = useDeleteMailProfile();
  const createCampaignMutation = useCreateCampaign();
  const sendCampaignMutation = useSendCampaign();

  // Navigation within Mail tab
  const [mode, setMode] = useState('campaigns'); // 'campaigns', 'new_campaign', 'profiles'

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
              onClick={() => sendCampaignMutation.mutate(row._id)}
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
            variant={mode === 'profiles' ? 'primary' : 'secondary'} 
            size="sm" 
            onClick={() => setMode('profiles')}
          >
            <Zap size={14} /> SMTP Profiles ({profiles.length})
          </Button>
        </div>

        <Button variant="secondary" size="sm" onClick={() => refetchStats()}>
          <RefreshCw size={14} /> Refresh Stats
        </Button>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Total Campaigns" value={stats?.totalCampaigns || campaigns.length} icon={Mail} variant="info" />
        <StatCard label="Emails Dispatched" value={stats?.totalSent || 0} icon={Send} variant="mint" />
        <StatCard label="Bounced / Failed" value={stats?.totalBounced || 0} icon={AlertCircle} variant="rose" />
        <StatCard label="Opens Tracked" value={stats?.totalOpened || 0} icon={CheckCircle2} variant="slate" />
      </div>

      {/* Mode: Campaigns List */}
      {mode === 'campaigns' && (
        <Card className="p-0 overflow-hidden border border-[var(--color-bg-border)]">
          <DataTable columns={campaignColumns} data={campaigns} />
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
               <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase hover:border-[var(--color-action-primary)] transition-all">
                 <Upload size={12} /> {htmlFileName ? htmlFileName : 'Upload HTML File'}
                 <input type="file" accept=".html,.htm" className="hidden" onChange={handleHtmlUpload} />
               </label>
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

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* CSV Upload Card */}
               <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-bold uppercase tracking-tight">CSV Direct Upload</span>
                   <Badge variant="info">{csvRecipients.length} Loaded</Badge>
                 </div>
                 <p className="text-[10px] text-[var(--color-text-muted)]">Upload a CSV containing "name" and "email" headers for direct mailing.</p>
                 <label className="w-full cursor-pointer flex items-center justify-center gap-2 py-2.5 bg-[var(--color-bg-primary)] border border-dashed border-[var(--color-bg-border)] rounded-xl text-xs font-bold hover:border-[var(--color-action-primary)] transition-all">
                   <Upload size={14} /> {csvFileName ? csvFileName : 'Select CSV File'}
                   <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                 </label>
               </div>

               {/* CRM Leads Selection Card */}
               <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-bold uppercase tracking-tight">Select CRM Leads</span>
                   <Badge variant="mint">{selectedLeadIds.length} Selected</Badge>
                 </div>
                 <p className="text-[10px] text-[var(--color-text-muted)]">Pick active leads from your master CRM directory with verified emails.</p>
                 <div className="max-h-28 overflow-y-auto space-y-1 pr-1 border border-[var(--color-bg-border)] rounded-xl p-2 bg-[var(--color-bg-primary)]">
                   {leads.map(l => {
                     const isSel = selectedLeadIds.includes(l._id);
                     return (
                       <div 
                         key={l._id} 
                         onClick={() => {
                           if (isSel) setSelectedLeadIds(selectedLeadIds.filter(id => id !== l._id));
                           else setSelectedLeadIds([...selectedLeadIds, l._id]);
                         }}
                         className={`p-1.5 rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-between transition-all ${isSel ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}
                       >
                         <span>{l.name} ({l.email})</span>
                         {isSel && <Check size={12} />}
                       </div>
                     );
                   })}
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
    </div>
  );
}
