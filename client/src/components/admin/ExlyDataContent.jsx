import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, RefreshCw, Key, ShieldAlert, AlertCircle, CheckCircle2,
  DollarSign, Calendar, Percent, Users, UserPlus, ShoppingBag, Heart, Search,
  SlidersHorizontal, BarChart3, TrendingUp, HelpCircle
} from 'lucide-react';
import { Badge, Card, StatCard, DataTable, Button, ProgressBar, FullScreenWorkspace, Input } from '../ui';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts';

const ExlyDataContent = () => {
  const [offerings, setOfferings] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  // Dashboard Stats (charts & debug)
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Sorting & Filtering Offerings
  const [offeringSearch, setOfferingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('revenue_desc');

  // Immersive Workspace States
  const [selectedOffering, setSelectedOffering] = useState(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  
  // Workspace Edit States
  const [editedTitle, setEditedTitle] = useState('');
  const [editedPrice, setEditedPrice] = useState(0);
  const [editedType, setEditedType] = useState('program');
  const [editedStatus, setEditedStatus] = useState('active');
  const [editedEventDate, setEditedEventDate] = useState('');
  const [editedEventTime, setEditedEventTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Search Filter for campaign customers
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStatusAndData = async () => {
    setLoading(true);
    setError('');
    try {
      const [configRes, offeringsRes] = await Promise.all([
        axios.get('/api/exly/config'),
        axios.get('/api/exly/offerings')
      ]);
      setConfig(configRes.data);
      setOfferings(offeringsRes.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to pull Exly integration credentials/records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get('/api/exly/dashboard-stats');
      setDashboardStats(res.data);
    } catch (err) {
      console.error('[Exly Fetch Dashboard Stats Error]', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndData();
    fetchDashboardStats();
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError('');
    try {
      await axios.post('/api/exly/sync');
      await Promise.all([fetchStatusAndData(), fetchDashboardStats()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Exly API Sync Execution Failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleRowClick = async (offering) => {
    setSelectedOffering(offering);
    setWorkspaceOpen(true);
    setDetailsLoading(true);
    setDetailsError('');
    setDetails(null);

    // Initial edit states from table row object
    setEditedTitle(offering.title || '');
    setEditedPrice(offering.price || 0);
    setEditedType(offering.type || 'program');
    setEditedStatus(offering.status || 'active');
    setEditedEventDate(offering.eventDate || '');
    setEditedEventTime(offering.eventTime || '');

    try {
      const res = await axios.get(`/api/exly/offerings/${offering.offeringId}`);
      setDetails(res.data);
      // Synchronize with fresh details
      setEditedTitle(res.data.offering.title || '');
      setEditedPrice(res.data.offering.price || 0);
      setEditedType(res.data.offering.type || 'program');
      setEditedStatus(res.data.offering.status || 'active');
      setEditedEventDate(res.data.offering.eventDate || '');
      setEditedEventTime(res.data.offering.eventTime || '');
    } catch (err) {
      console.error(err);
      setDetailsError(err.response?.data?.error || 'Failed to load detailed offering metrics.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedOffering || isSaving) return;
    setIsSaving(true);
    setDetailsError('');
    try {
      const res = await axios.put(`/api/exly/offerings/${selectedOffering.offeringId}`, {
        title: editedTitle,
        price: editedPrice,
        type: editedType,
        status: editedStatus,
        eventDate: editedEventDate,
        eventTime: editedEventTime
      });
      
      // Update local offerings list
      setOfferings(prev => prev.map(o => o.offeringId === selectedOffering.offeringId ? { ...o, ...res.data.offering } : o));
      
      // Update workspace details
      if (details) {
        setDetails(prev => ({
          ...prev,
          offering: res.data.offering
        }));
      }
      setWorkspaceOpen(false);
    } catch (err) {
      console.error(err);
      setDetailsError(err.response?.data?.error || 'Failed to save offering modifications.');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      header: 'Offering Name',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] shrink-0 text-[var(--color-text-primary)]">
            {item.title?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--color-text-primary)]">{item.title}</span>
              <Badge variant={item.status === 'active' ? 'success' : 'warning'} className="!text-[9px] uppercase tracking-wider">
                {item.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-[var(--color-text-muted)] font-mono">ID: {item.offeringId}</span>
              {(item.eventDate || item.eventTime) && (
                <span className="text-[9px] text-[var(--color-pastel-apricot-text)] bg-[var(--color-pastel-apricot-bg)] px-1 rounded font-mono">
                  {item.eventDate} {item.eventTime}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Price',
      render: (item) => (
        <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
          {item.currency} {item.price.toLocaleString()}
        </span>
      )
    },
    {
      header: 'Total Bookings',
      render: (item) => (
        <span className="text-xs font-bold text-[var(--color-text-primary)]">{item.totalBookings}</span>
      )
    },
    {
      header: 'Conversion Rate',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">{item.conversionRate}%</span>
          <div className="w-16">
            <ProgressBar value={item.conversionRate} max={100} variant={item.conversionRate > 20 ? 'mint' : item.conversionRate > 10 ? 'apricot' : 'rose'} />
          </div>
        </div>
      )
    },
    {
      header: 'Total Revenue',
      render: (item) => (
        <span className="text-xs font-bold text-[var(--color-text-primary)]">
          {item.currency} {item.totalRevenue.toLocaleString()}
        </span>
      )
    }
  ];

  const bookingColumns = [
    {
      header: 'Customer Details',
      render: (b) => (
        <div>
          <div className="font-bold text-xs text-[var(--color-text-primary)]">{b.name}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] font-mono">{b.email}</div>
        </div>
      )
    },
    {
      header: 'Phone Number',
      render: (b) => (
        <span className="text-xs font-mono text-[var(--color-text-primary)]">{b.phone || '—'}</span>
      )
    },
    {
      header: 'Booked On',
      render: (b) => (
        <span className="text-xs font-mono text-[var(--color-text-primary)]">
          {b.bookedOn ? format(new Date(b.bookedOn), 'MMM dd yyyy, hh:mm a') : '—'}
        </span>
      )
    },
    {
      header: 'Price Paid',
      render: (b) => (
        <span className="text-xs font-bold text-[var(--color-text-primary)] font-mono">
          INR {b.pricePaid?.toLocaleString() || 0}
        </span>
      )
    },
    {
      header: 'CRM Status Check',
      render: (b) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            {b.inCRM ? (
              <>
                <Badge variant="success" className="!text-[9px] uppercase tracking-wider">
                  Linked
                </Badge>
                <Badge variant={b.crmStatus === 'Converted' ? 'success' : b.crmStatus === 'Warm' ? 'warning' : 'rose'} className="!text-[9px] uppercase tracking-wider">
                  {b.crmStatus || 'Warm'}
                </Badge>
              </>
            ) : (
              <Badge variant="rose" className="!text-[9px] uppercase tracking-wider">
                Unlinked
              </Badge>
            )}
          </div>
          {b.inCRM && (
            <span className="text-[9px] text-[var(--color-text-muted)] font-semibold">
              Rep: {b.crmRep || 'Unassigned'}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Payout Status',
      render: (b) => (
        <Badge variant={b.payoutStatus?.toLowerCase() === 'processed' ? 'success' : 'warning'} className="!text-[9px] uppercase">
          {b.payoutStatus || 'Pending'}
        </Badge>
      )
    }
  ];

  // Calculate totals from offerings list for aggregate ribbon
  const totalRevenueAll = offerings.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalBookingsAll = offerings.reduce((acc, curr) => acc + curr.totalBookings, 0);
  const avgConversionAll = offerings.length > 0
    ? (offerings.reduce((acc, curr) => acc + curr.conversionRate, 0) / offerings.length).toFixed(1)
    : 0;

  // Filter and Sort offerings list
  const filteredOfferings = offerings
    .filter(off => {
      const matchesSearch = off.title.toLowerCase().includes(offeringSearch.toLowerCase()) || 
                            off.offeringId.toLowerCase().includes(offeringSearch.toLowerCase());
      const matchesStatus = statusFilter === 'all' || off.status === statusFilter;
      const matchesType = typeFilter === 'all' || off.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'revenue_desc': return b.totalRevenue - a.totalRevenue;
        case 'revenue_asc': return a.totalRevenue - b.totalRevenue;
        case 'bookings_desc': return b.totalBookings - a.totalBookings;
        case 'bookings_asc': return a.totalBookings - b.totalBookings;
        case 'conversion_desc': return b.conversionRate - a.conversionRate;
        case 'conversion_asc': return a.conversionRate - b.conversionRate;
        case 'title_asc': return a.title.localeCompare(b.title);
        case 'title_desc': return b.title.localeCompare(a.title);
        default: return b.totalRevenue - a.totalRevenue;
      }
    });

  // Filter bookings list based on query inside workspace details
  const filteredBookings = details?.bookings?.filter(b => 
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.phone?.includes(searchQuery)
  ) || [];

  if (loading) {
    return (
      <div className="p-8 text-center opacity-40">
        <RefreshCw className="animate-spin mx-auto mb-2 text-[var(--color-text-muted)]" size={24} />
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Hydrating Exly Credentials & Listings...</p>
      </div>
    );
  }

  // Pre-process date data for Recharts area charts
  const overallChartData = dashboardStats?.chartData || [];
  const campaignChartData = details?.chartData || [];
  return (
    <div className="space-y-6 p-4">

      {error && (
        <div className="p-3 bg-[#FCE8E6] text-[#C5221F] rounded-xl flex items-center gap-2 text-[10px] font-bold">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate metrics ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard 
          label="Total Offerings" 
          value={offerings.length} 
          icon={Calendar} 
          variant="info" 
          info="Total offerings created and active on Exly Creator profile." 
        />
        <StatCard 
          label="Unified Bookings" 
          value={totalBookingsAll} 
          icon={Database} 
          variant="mint" 
          info="Aggregate bookings and clients registered across offerings." 
        />
        <StatCard 
          label="Avg Conversion Rate" 
          value={`${avgConversionAll}%`} 
          icon={Percent} 
          variant="apricot" 
          info="Average conversion rate of Exly bookings converted to Converted CRM status. Calculated as: (Converted CRM Leads / Total Offering Leads) * 100." 
        />
        <StatCard 
          label="Aggregate Revenue" 
          value={`INR ${totalRevenueAll.toLocaleString()}`} 
          icon={DollarSign} 
          variant="slate" 
          info="Accumulated revenue of client purchases through Exly." 
        />
      </div>

      {/* Recharts Overall Analytics Visuals */}
      {!statsLoading && overallChartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
            <div className="flex items-center justify-between mb-3 border-b border-[var(--color-bg-border)] pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Revenue Over Time (Real-time Stream)
              </span>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-pastel-mint-text)]">
                <TrendingUp size={12} />
                <span>INR</span>
              </div>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overallChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#81C995" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#81C995" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-border)" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                  <ChartTooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-bg-surface)', 
                      borderColor: 'var(--color-bg-border)', 
                      fontSize: '11px',
                      borderRadius: '8px'
                    }}
                    labelClassName="font-mono text-xs"
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue (INR)" stroke="#81C995" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
            <div className="flex items-center justify-between mb-3 border-b border-[var(--color-bg-border)] pb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Booking Volume Trend
              </span>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-pastel-apricot-text)]">
                <BarChart3 size={12} />
                <span>Transactions</span>
              </div>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overallChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FDD663" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#FDD663" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-border)" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
                  <ChartTooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-bg-surface)', 
                      borderColor: 'var(--color-bg-border)', 
                      fontSize: '11px',
                      borderRadius: '8px'
                    }}
                    labelClassName="font-mono text-xs"
                  />
                  <Area type="monotone" dataKey="bookings" name="Bookings Count" stroke="#FDD663" fillOpacity={1} fill="url(#colorBookings)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Offerings Table with Sort/Filter Ribbon */}
      <Card className="p-0 overflow-hidden">
        {/* Ribbon Header with sorting and filtering controls */}
        <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-[var(--color-text-muted)]" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Campaign Performance Listings</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={offeringSearch}
                onChange={(e) => setOfferingSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md focus:border-[var(--color-action-primary)] outline-none text-[11px] font-semibold text-[var(--color-text-primary)] transition-all"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md text-[11px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
              >
                <option value="all">All Types</option>
                <option value="program">Program</option>
                <option value="Webinar">Webinar</option>
                <option value="Packages">Packages</option>
                <option value="Recorded Course">Recorded Course</option>
                <option value="Branded Community">Branded Community</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md text-[11px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            {/* Sort Option */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md text-[11px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
              >
                <option value="revenue_desc">Revenue: High to Low</option>
                <option value="revenue_asc">Revenue: Low to High</option>
                <option value="bookings_desc">Bookings: High to Low</option>
                <option value="bookings_asc">Bookings: Low to High</option>
                <option value="conversion_desc">Conversion Rate: High to Low</option>
                <option value="conversion_asc">Conversion Rate: Low to High</option>
                <option value="title_asc">Title: A to Z</option>
                <option value="title_desc">Title: Z to A</option>
              </select>
            </div>
          </div>
        </div>
        
        {filteredOfferings.length === 0 ? (
          <div className="p-12 text-center opacity-30">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">No campaigns match search filters</p>
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={filteredOfferings} 
            onRowClick={handleRowClick}
          />
        )}
      </Card>

      {/* Real-time Webhook / CSV Stream Debugger Card */}
      {!statsLoading && dashboardStats?.recentBooking && (
        <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
          <div className="border-b border-[var(--color-bg-border)] pb-2 mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-pastel-mint-text)]">
              Most Recent Booking Debug logs (Real-time Stream)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-[10px] font-bold">
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Client Name:</span>
              <p className="text-[var(--color-text-primary)]">{dashboardStats.recentBooking.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Email Profile:</span>
              <p className="text-[var(--color-text-primary)] font-mono">{dashboardStats.recentBooking.email || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Phone / Mobile:</span>
              <p className="text-[var(--color-text-primary)] font-mono">{dashboardStats.recentBooking.phone || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Offering Purchased:</span>
              <p className="text-[var(--color-text-primary)]">{dashboardStats.recentBooking.offeringTitle}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Price Settled:</span>
              <p className="text-[var(--color-text-primary)] font-mono">INR {dashboardStats.recentBooking.pricePaid?.toLocaleString() || 0}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Booking Date:</span>
              <p className="text-[var(--color-text-primary)] font-mono">
                {dashboardStats.recentBooking.bookedOn ? format(new Date(dashboardStats.recentBooking.bookedOn), 'yyyy-MM-dd HH:mm:ss') : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Transaction ID:</span>
              <p className="text-[var(--color-text-primary)] font-mono">{dashboardStats.recentBooking.transactionId || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider">Payout State:</span>
              <p className="text-[var(--color-text-primary)] uppercase font-mono">{dashboardStats.recentBooking.payoutStatus || 'Processed'}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Immersive Workspace Modal Sheet */}
      <FullScreenWorkspace
        isOpen={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        title={editedTitle || selectedOffering?.title || 'Offering Details'}
        subtitle={`Exly ID: ${selectedOffering?.offeringId || ''}`}
        onSave={handleSaveChanges}
        extraActions={
          isSaving && (
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] animate-pulse uppercase tracking-wider">
              Saving local overrides...
            </span>
          )
        }
        sidebar={
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                Local Fields Configuration
              </h3>
              <div className="space-y-4">
                <Input 
                  label="Local Title" 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)} 
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="Event Date" 
                    placeholder="e.g. 11th Jan"
                    value={editedEventDate} 
                    onChange={(e) => setEditedEventDate(e.target.value)} 
                  />
                  <Input 
                    label="Event Time" 
                    placeholder="e.g. 12:30pm"
                    value={editedEventTime} 
                    onChange={(e) => setEditedEventTime(e.target.value)} 
                  />
                </div>

                <Input 
                  label="Base Price (INR)" 
                  type="number"
                  value={editedPrice} 
                  onChange={(e) => setEditedPrice(Number(e.target.value) || 0)} 
                />

                <div className="space-y-1 w-full">
                  <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-0.5">
                    Offering Type
                  </label>
                  <select 
                    value={editedType} 
                    onChange={(e) => setEditedType(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-sm text-[var(--color-text-primary)]"
                  >
                    <option value="program">Program</option>
                    <option value="Webinar">Webinar</option>
                    <option value="Packages">Packages</option>
                    <option value="Recorded Course">Recorded Course</option>
                    <option value="Branded Community">Branded Community</option>
                  </select>
                </div>

                <div className="space-y-1 w-full">
                  <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-0.5">
                    Status
                  </label>
                  <select 
                    value={editedStatus} 
                    onChange={(e) => setEditedStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-sm text-[var(--color-text-primary)]"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--color-bg-border)] pt-4 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Performance Metadata
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                <span className="text-[var(--color-text-muted)]">Type:</span>
                <span className="text-right font-mono text-[var(--color-text-primary)]">{details?.offering?.type || '—'}</span>

                <span className="text-[var(--color-text-muted)]">Local Status:</span>
                <span className="text-right">
                  <Badge variant={details?.offering?.status === 'active' ? 'success' : 'warning'}>
                    {details?.offering?.status || '—'}
                  </Badge>
                </span>

                <span className="text-[var(--color-text-muted)]">Avg Customer LTV:</span>
                <span className="text-right font-mono text-[var(--color-pastel-mint-text)]">
                  INR {details?.analytics?.avgLTV?.toLocaleString() || 0}
                </span>

                <span className="text-[var(--color-text-muted)]">Created Date:</span>
                <span className="text-right font-mono text-[var(--color-text-primary)]">
                  {details?.offering?.createdAt ? format(new Date(details.offering.createdAt), 'yyyy-MM-dd') : '—'}
                </span>
              </div>
            </div>
          </div>
        }
      >
        {detailsLoading ? (
          <div className="py-24 text-center opacity-40">
            <RefreshCw className="animate-spin mx-auto mb-2 text-[var(--color-text-muted)]" size={24} />
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Hydrating Customer Profiles & Metrics...</p>
          </div>
        ) : detailsError ? (
          <div className="p-4 bg-[#FCE8E6] text-[#C5221F] rounded-xl flex items-center gap-2 text-[10px] font-bold">
            <AlertCircle size={14} />
            <span>{detailsError}</span>
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* The Five Analytical Counters Matching the Screenshot */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <StatCard 
                label="Total Customers" 
                value={details.analytics.totalCustomers} 
                icon={Users} 
                variant="info" 
                info="Total unique customer contacts registered for this offering." 
              />
              <StatCard 
                label="New Customers" 
                value={details.analytics.newCustomers} 
                icon={UserPlus} 
                variant="mint" 
                info="Customers whose first-ever booking was this offering." 
              />
              <StatCard 
                label="Upsells" 
                value={details.analytics.upsells} 
                icon={ShoppingBag} 
                variant="apricot" 
                info="Customers who purchased this offering after buying another offering previously." 
              />
              <StatCard 
                label="Loyal Customers" 
                value={details.analytics.loyalCustomers} 
                icon={Heart} 
                variant="rose" 
                info="Customers of this offering who have 2 or more total purchases." 
              />
              <StatCard 
                label="Cohort LTV" 
                value={`INR ${details.analytics.lifetimeValue.toLocaleString()}`} 
                icon={DollarSign} 
                variant="slate" 
                info="Aggregate lifetime value (LTV) across all offerings for the cohort of customers who purchased this offering." 
              />
            </div>

            {/* Campaign-level Charts */}
            {campaignChartData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                  <div className="border-b border-[var(--color-bg-border)] pb-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                      Campaign Revenue Flow
                    </span>
                  </div>
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={campaignChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorCampRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#81C995" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#81C995" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-border)" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }} />
                        <YAxis tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }} />
                        <ChartTooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--color-bg-surface)', 
                            borderColor: 'var(--color-bg-border)', 
                            fontSize: '10px',
                            borderRadius: '6px'
                          }}
                        />
                        <Area type="monotone" dataKey="revenue" name="Rev (INR)" stroke="#81C995" fillOpacity={1} fill="url(#colorCampRev)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                  <div className="border-b border-[var(--color-bg-border)] pb-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                      Campaign Booking Flow
                    </span>
                  </div>
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={campaignChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorCampBooks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FDD663" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#FDD663" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-border)" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }} />
                        <YAxis tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }} />
                        <ChartTooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--color-bg-surface)', 
                            borderColor: 'var(--color-bg-border)', 
                            fontSize: '10px',
                            borderRadius: '6px'
                          }}
                        />
                        <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#FDD663" fillOpacity={1} fill="url(#colorCampBooks)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}

            {/* Customers List Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    Registered Customers List & CRM Lead Checks
                  </h3>
                  <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
                    Showing {filteredBookings.length} of {details.bookings.length} total customer bookings
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search by name, email or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none text-xs font-semibold text-[var(--color-text-primary)] transition-all"
                  />
                </div>
              </div>

              <div className="overflow-hidden bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                {filteredBookings.length === 0 ? (
                  <div className="p-12 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">No matching customer bookings</p>
                  </div>
                ) : (
                  <DataTable
                    columns={bookingColumns}
                    data={filteredBookings}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </FullScreenWorkspace>
    </div>
  );
};

export default ExlyDataContent;
