import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Search, Upload, Filter, ChevronLeft, ChevronRight, 
  User, Mail, Phone, MapPin, Tag, Briefcase, Link, Info, 
  CheckCircle2, XCircle, AlertCircle, Trash2, ArrowRight, RefreshCw, 
  MoreVertical, FileText, ExternalLink, ShieldCheck, Zap, PieChart, TrendingUp, BarChart3, Clock, 
  Target, Globe, Calendar, Link2, X, Activity, UserCheck
} from 'lucide-react';
import { 
  Badge, Card, NexusModal, PageHeader, NexusDropdown, DataTable, 
  Button, Input, StatCard, ProgressBar, FullScreenWorkspace, InfoButton,
  InputFormDrawer
} from '../ui';
import { format } from 'date-fns';

const TscDataContent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pages, setPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState('selected'); 
  
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    campaign: 'all',
    originSource: 'all',
    role: 'all',
    syncStatus: 'all'
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sample, setSample] = useState([]);
  const [tempPath, setTempPath] = useState('');
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tsc', {
        params: { 
          page, 
          search: searchTerm, 
          limit: pageSize, 
          ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== 'all'))
        }
      });
      setData(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/tsc/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset to page 1 on filter/search change to ensure we search the WHOLE database from start
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filters]);

  useEffect(() => {
    fetchData();
  }, [page, searchTerm, pageSize, filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    try {
      const res = await axios.post('/api/tsc/upload', formData);
      setHeaders(res.data.headers);
      setSample(res.data.sample);
      setTempPath(res.data.tempPath);
      setRowCount(res.data.rowCount);
      setImportFile(file);
      const initialMapping = {};
      res.data.headers.forEach(h => initialMapping[h] = 'metadata');
      setMapping(initialMapping);
      setImportStep(2);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  const handleImportExecute = async () => {
    setImporting(true);
    try {
      await axios.post('/api/tsc/import', { mapping, tempPath, filename: importFile.name });
      setShowImportModal(false);
      setImportStep(1);
      fetchData();
      fetchStats();
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (deleteMode === 'selected') {
        await axios.post('/api/tsc/bulk-delete', { ids: selectedIds });
      } else {
        await axios.post('/api/tsc/bulk-delete', { filter: filters, search: searchTerm });
      }
      setSelectedIds([]);
      setShowDeleteConfirm(false);
      fetchData();
      fetchStats();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const columns = [
    {
      header: 'Lead',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] shrink-0">
            {item.name?.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-tight truncate">{item.name}</p>
            <p className="text-[9px] text-[var(--color-text-muted)] font-bold truncate">{item.email || 'No contact link'}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Source',
      info: 'The channel or campaign from which this entry originated.',
      render: (item) => (
        <div className="space-y-1">
          <Badge variant={item.campaign ? 'info' : 'neutral'}>{item.campaign || 'Organic'}</Badge>
          <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase ml-1">{item.originSource}</p>
        </div>
      )
    },
    {
      header: 'Location',
      render: (item) => <span className="text-[10px] font-bold uppercase">{item.city || 'Undisclosed'}</span>
    },
    {
      header: 'Status',
      info: 'Indicates if the record has been fully processed and synced with CRM records.',
      render: (item) => (
        <Badge variant={item.leadData ? 'success' : 'warning'}>
          {item.leadData ? 'Processed' : 'Awaiting Sync'}
        </Badge>
      )
    },
    {
      header: 'Assigned',
      render: (item) => (
        <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">
          {item.leadData?.assignedRepId?.name || '--'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Module-Specific Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
         <StatCard 
           label="Total Records" 
           value={stats?.summary?.total[0]?.count || 0} 
           icon={Database} 
           variant="info" 
           info="Grand total of all entries across the master database." 
         />
         <StatCard 
           label="Top Campaign" 
           value={stats?.summary?.campaigns[0]?._id || 'N/A'} 
           icon={Target} 
           variant="apricot" 
           subValue={`${stats?.summary?.campaigns[0]?.count || 0}`}
           info="The campaign with the highest volume of unique lead entries." 
         />
         <StatCard 
           label="Primary Source" 
           value={stats?.summary?.sources[0]?._id || 'N/A'} 
           icon={Globe} 
           variant="mint" 
           subValue={`${stats?.summary?.sources[0]?.count || 0}`}
           info="The most common origin channel for incoming data." 
         />
         <StatCard 
           label="Processed" 
           value={data.filter(i => i.leadData).length} 
           icon={UserCheck} 
           variant="slate" 
           subValue="Current View"
           info="Number of records in the current view that are synced with active CRM leads." 
         />
      </div>

      <Card className="p-4 bg-[var(--color-bg-secondary)] border-dashed border-2">
         <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md">
               <Input 
                 icon={Search} 
                 placeholder="Search across entire database..." 
                 value={searchTerm} 
                 onChange={e => setSearchTerm(e.target.value)}
                 className="!py-1"
               />
               <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                 <Upload size={14} /> Import Data
               </Button>
            </div>
            <div className="flex items-center gap-2">
               {selectedIds.length > 0 && (
                 <Button variant="danger" size="sm" onClick={() => { setDeleteMode('selected'); setShowDeleteConfirm(true); }}>
                   Delete ({selectedIds.length})
                 </Button>
               )}
               <Button variant="ghost" size="sm" onClick={fetchData}>
                 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
               </Button>
            </div>
         </div>

         {/* Filter Matrix */}
         <div className="grid grid-cols-4 gap-3 mt-4">
             <NexusDropdown
               placeholder="Campaign"
               options={[{ value: 'all', label: 'All Campaigns' }, ...(stats?.filters.campaigns.map(c => ({ value: c, label: c.toUpperCase() })) || [])]}
               value={filters.campaign}
               onChange={v => setFilters({...filters, campaign: v})}
             />
             <NexusDropdown
               placeholder="Lead Source"
               options={[{ value: 'all', label: 'All Sources' }, ...(stats?.filters.sources.map(s => ({ value: s, label: s.toUpperCase() })) || [])]}
               value={filters.originSource}
               onChange={v => setFilters({...filters, originSource: v})}
             />
             <NexusDropdown
               placeholder="Personnel Role"
               options={[{ value: 'all', label: 'All Roles' }, ...(stats?.filters.roles.map(r => ({ value: r, label: r.toUpperCase() })) || [])]}
               value={filters.role}
               onChange={v => setFilters({...filters, role: v})}
             />
             <NexusDropdown
               placeholder="Processing State"
               options={[
                 { value: 'all', label: 'All States' },
                 { value: 'synced', label: 'Processed' },
                 { value: 'unsynced', label: 'Awaiting Sync' }
               ]}
               value={filters.syncStatus}
               onChange={v => setFilters({...filters, syncStatus: v})}
             />
         </div>
      </Card>

      {/* Data Table */}
      <DataTable 
        columns={columns} 
        data={data} 
        onRowClick={(item) => setSelectedItem(item)}
      />

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-4">
         <div className="flex items-center gap-4">
            <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">
              Showing {data.length} of {total} records
            </p>
            {searchTerm && <Badge variant="info" className="!text-[8px]">Global Search Active</Badge>}
         </div>
         <div className="flex items-center gap-2">
            <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={12} /></Button>
            <span className="text-[10px] font-black px-2">{page} / {pages}</span>
            <Button variant="secondary" size="xs" disabled={page === pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={12} /></Button>
         </div>
      </div>

      {/* Immersive Record Workspace */}
      <FullScreenWorkspace
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || 'Record Detail'}
        subtitle={`Database ID: ${selectedItem?._id?.substring(0, 8)} • Source: ${selectedItem?.originSource?.toUpperCase()}`}
        onSave={() => setSelectedItem(null)}
        sidebar={
          <>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Entry Metadata</h4>
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold">Import Date</span>
                     <span className="text-[10px] opacity-60">Oct 24, 2023</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold">Sync Status</span>
                     <Badge variant={selectedItem?.leadData ? 'success' : 'warning'}>
                        {selectedItem?.leadData ? 'Processed' : 'Pending'}
                     </Badge>
                  </div>
               </div>
            </Card>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Source Insights</h4>
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-bg-secondary)] rounded-lg text-[var(--color-action-primary)]">
                     <Globe size={16} />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold">Origin Tracking</p>
                     <p className="text-[8px] text-[var(--color-text-muted)] uppercase">{selectedItem?.originSource || 'Direct Entry'}</p>
                  </div>
               </div>
            </Card>
          </>
        }
      >
        <div className="space-y-8">
           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <User size={14} /> Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-6">
                 <Input label="Name" defaultValue={selectedItem?.name} />
                 <Input label="Email Address" defaultValue={selectedItem?.email} />
                 <Input label="Phone Number" defaultValue={selectedItem?.phone} />
                 <Input label="Current City" defaultValue={selectedItem?.city} />
              </div>
           </section>

           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Briefcase size={14} /> Professional Details
              </h3>
              <div className="grid grid-cols-2 gap-6">
                 <Input label="Assigned Role" defaultValue={selectedItem?.role} />
                 <Input label="Associated Campaign" defaultValue={selectedItem?.campaign} />
              </div>
           </section>

           {selectedItem?.leadData && (
             <section className="p-6 bg-[var(--color-bg-secondary)] rounded-3xl border border-[var(--color-action-primary)]/10">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-action-primary)] mb-4 flex items-center gap-2">
                   <ShieldCheck size={14} /> CRM Lifecycle Sync
                </h3>
                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <div>
                         <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-1">Representative</p>
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] flex items-center justify-center text-[10px] font-black">
                               {selectedItem.leadData.assignedRepId?.name?.substring(0, 2) || 'UN'}
                            </div>
                            <span className="text-sm font-bold">{selectedItem.leadData.assignedRepId?.name || 'Unassigned'}</span>
                         </div>
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-1">Current Funnel Status</p>
                         <Badge variant="info">{selectedItem.leadData.leadStatus}</Badge>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div>
                         <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-1">Engagement Quality</p>
                         <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map(s => (
                               <div key={s} className={`w-2 h-2 rounded-full ${s <= (parseInt(selectedItem.leadData.leadQuality) || 0) ? 'bg-amber-400' : 'bg-[var(--color-bg-border)]'}`} />
                            ))}
                         </div>
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-1">Last Interaction Outcome</p>
                         <Badge variant={selectedItem.leadData.callStatus === 'Connected' ? 'success' : 'neutral'}>
                            {selectedItem.leadData.callStatus}
                         </Badge>
                      </div>
                   </div>
                </div>
             </section>
           )}
        </div>
      </FullScreenWorkspace>

      {/* Import Modal */}
      <InputFormDrawer 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        title="Import CSV Data"
      >
        {importStep === 1 ? (
          <div className="space-y-6 text-center py-8">
            <div className="border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl p-12 hover:border-[var(--color-action-primary)]/50 transition-all cursor-pointer relative group">
               <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
               <div className="w-16 h-16 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={24} className="text-[var(--color-action-primary)]" />
               </div>
               <p className="text-xs font-black uppercase tracking-widest">Select CSV File</p>
               <p className="text-[9px] font-bold text-[var(--color-text-muted)] mt-2 uppercase">Max size: 10MB</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest text-center">Map your headers to system fields</p>
            <div className="space-y-2">
               {headers.map(h => (
                 <div key={h} className="flex items-center justify-between gap-4 p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                    <span className="text-[10px] font-black uppercase truncate flex-1">{h}</span>
                    <ArrowRight size={12} className="text-[var(--color-text-muted)] shrink-0" />
                    <select 
                      className="bg-transparent text-[10px] font-black uppercase outline-none min-w-[100px]"
                      value={mapping[h]}
                      onChange={(e) => setMapping({...mapping, [h]: e.target.value})}
                    >
                       <option value="name">Name</option>
                       <option value="email">Email</option>
                       <option value="phone">Phone</option>
                       <option value="city">City</option>
                       <option value="role">Role</option>
                       <option value="metadata">Metadata</option>
                       <option value="IGNORE">Ignore</option>
                    </select>
                 </div>
               ))}
            </div>
            <Button className="w-full py-4" onClick={handleImportExecute} disabled={importing}>
               {importing ? 'Processing Data...' : 'Confirm & Sync'}
            </Button>
          </div>
        )}
      </InputFormDrawer>

      <NexusModal 
        isOpen={showDeleteConfirm} 
        onClose={() => setShowDeleteConfirm(false)} 
        title="Confirm Removal"
        message="This action will permanently delete the selected records from the master database."
        type="danger"
        isConfirm
        onConfirm={handleBulkDelete}
      />
    </div>
  );
};

export default TscDataContent;
