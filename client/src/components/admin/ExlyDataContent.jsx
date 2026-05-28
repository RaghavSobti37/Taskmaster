import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, RefreshCw, Key, ShieldAlert, AlertCircle, CheckCircle2,
  IndianRupee, Calendar, Percent, Users, UserPlus, ShoppingBag, Heart, Search,
  SlidersHorizontal, BarChart3, TrendingUp, HelpCircle, X
} from 'lucide-react';
import { Badge, Card, StatCard, DataTable, Button, ProgressBar, FullScreenWorkspace, Input, Skeleton } from '../ui';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const ExlyDataContent = ({ mode = 'campaigns' }) => {
  const [offerings, setOfferings] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  // Sub-Tab Switcher State (now controlled by prop)
  const [currentSubTab, setCurrentSubTab] = useState(mode);

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
  
  // Workspace Loading States (Split Loading)
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [cohortAnalytics, setCohortAnalytics] = useState(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortChartData, setCohortChartData] = useState([]);
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

  // Unlinked Bookings States
  const [unlinkedBookings, setUnlinkedBookings] = useState([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const [selectedUnlinkedIds, setSelectedUnlinkedIds] = useState(new Set());
  const [unlinkedSearch, setUnlinkedSearch] = useState('');
  const [unlinkedOfferingFilter, setUnlinkedOfferingFilter] = useState('all');
  const [unlinkedSort, setUnlinkedSort] = useState('offering_asc');
  const [linkingInProgress, setLinkingInProgress] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
  
  // Unlinked Bookings Pagination
  const [unlinkedPage, setUnlinkedPage] = useState(1);
  const [unlinkedRowsPerPage, setUnlinkedRowsPerPage] = useState(25);

  useEffect(() => {
    setUnlinkedPage(1);
  }, [unlinkedSearch, unlinkedOfferingFilter, unlinkedSort]);

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

  const fetchUnlinked = async () => {
    try {
      setUnlinkedLoading(true);
      const res = await axios.get('/api/exly/unlinked-bookings');
      setUnlinkedBookings(res.data);
    } catch (e) {
      console.error('Failed to fetch unlinked bookings', e);
    } finally {
      setUnlinkedLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndData();
    fetchDashboardStats();
    fetchUnlinked();
  }, []);

  const toggleSelectAll = () => {
    if (selectedUnlinkedIds.size === filteredUnlinked.length) {
      setSelectedUnlinkedIds(new Set());
    } else {
      setSelectedUnlinkedIds(new Set(filteredUnlinked.map(b => b._id)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedUnlinkedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedUnlinkedIds(next);
  };

  const handleLinkSelected = async () => {
    if (selectedUnlinkedIds.size === 0 || linkingInProgress) return;
    try {
      setLinkingInProgress(true);
      setLinkMessage('Creating leads backup and importing bookings...');
      const res = await axios.post('/api/exly/unlinked-bookings/link', {
        bookingIds: Array.from(selectedUnlinkedIds)
      });
      setLinkMessage(res.data.message);
      setSelectedUnlinkedIds(new Set());
      await Promise.all([
        fetchStatusAndData(),
        fetchDashboardStats(),
        fetchUnlinked()
      ]);
      setTimeout(() => {
        setLinkMessage('');
      }, 5000);
    } catch (err) {
      console.error(err);
      setLinkMessage(err.response?.data?.error || 'Link operation failed.');
    } finally {
      setLinkingInProgress(false);
    }
  };

  const handleLinkAllFiltered = async () => {
    if (filteredUnlinked.length === 0 || linkingInProgress) return;
    try {
      setLinkingInProgress(true);
      setLinkMessage('Creating leads backup and importing bookings...');
      const res = await axios.post('/api/exly/unlinked-bookings/link', {
        bookingIds: filteredUnlinked.map(b => b._id)
      });
      setLinkMessage(res.data.message);
      setSelectedUnlinkedIds(new Set());
      await Promise.all([
        fetchStatusAndData(),
        fetchDashboardStats(),
        fetchUnlinked()
      ]);
      setTimeout(() => {
        setLinkMessage('');
      }, 5000);
    } catch (err) {
      console.error(err);
      setLinkMessage(err.response?.data?.error || 'Link operation failed.');
    } finally {
      setLinkingInProgress(false);
    }
  };

  const uniqueUnlinkedOfferings = Array.from(
    new Set(unlinkedBookings.map(b => b.offeringTitle).filter(Boolean))
  ).sort();

  const filteredUnlinked = unlinkedBookings
    .filter(b => 
      b.name?.toLowerCase().includes(unlinkedSearch.toLowerCase()) ||
      b.email?.toLowerCase().includes(unlinkedSearch.toLowerCase()) ||
      b.phone?.includes(unlinkedSearch) ||
      b.offeringTitle?.toLowerCase().includes(unlinkedSearch.toLowerCase())
    )
    .filter(b => unlinkedOfferingFilter === 'all' || b.offeringTitle === unlinkedOfferingFilter)
    .sort((a, b) => {
      if (unlinkedSort === 'offering_asc') return (a.offeringTitle || '').localeCompare(b.offeringTitle || '');
      if (unlinkedSort === 'offering_desc') return (b.offeringTitle || '').localeCompare(a.offeringTitle || '');
      if (unlinkedSort === 'date_desc') return new Date(b.bookedOn || 0) - new Date(a.bookedOn || 0);
      return 0;
    });

  const totalPages = Math.ceil(filteredUnlinked.length / unlinkedRowsPerPage) || 1;
  const paginatedUnlinked = filteredUnlinked.slice(
    (unlinkedPage - 1) * unlinkedRowsPerPage,
    unlinkedPage * unlinkedRowsPerPage
  );

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError('');
    try {
      await axios.post('/api/exly/sync');
      await Promise.all([fetchStatusAndData(), fetchDashboardStats(), fetchUnlinked()]);
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
    setCohortLoading(true);
    setDetailsError('');
    setDetails(null);
    setCohortAnalytics(null);
    setCohortChartData([]);

    // Initial edit states from table row object
    setEditedTitle(offering.title || '');
    setEditedPrice(offering.price || 0);
    setEditedType(offering.type || 'program');
    setEditedStatus(offering.status || 'active');
    setEditedEventDate(offering.eventDate || '');
    setEditedEventTime(offering.eventTime || '');

    // Part 1: Fast load offering details & bookings
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

    // Part 2: Background load cohort analytics
    try {
      const res = await axios.get(`/api/exly/offerings/${offering.offeringId}/analytics`);
      setCohortAnalytics(res.data.analytics);
      setCohortChartData(res.data.chartData);
    } catch (err) {
      console.error('Failed to load offering cohort analytics:', err);
    } finally {
      setCohortLoading(false);
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
      header: 'Unlinked CRM Bookings',
      render: (item) => {
        const count = unlinkedBookings.filter(b => b.offeringId === item.offeringId).length;
        return (
          <div className="flex items-center gap-1.5 font-bold">
            {count > 0 ? (
              <span className="text-xs font-mono text-[var(--color-pastel-rose-text)] bg-[var(--color-pastel-rose-bg)] px-1.5 py-0.5 rounded flex items-center gap-1">
                <ShieldAlert size={10} />
                {count} unlinked
              </span>
            ) : (
              <span className="text-xs font-mono text-[var(--color-pastel-mint-text)] bg-[var(--color-pastel-mint-bg)] px-1.5 py-0.5 rounded">
                0
              </span>
            )}
          </div>
        );
      }
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
        case 'unlinked_desc': {
          const aCount = unlinkedBookings.filter(x => x.offeringId === a.offeringId).length;
          const bCount = unlinkedBookings.filter(x => x.offeringId === b.offeringId).length;
          return bCount - aCount;
        }
        case 'unlinked_asc': {
          const aCount = unlinkedBookings.filter(x => x.offeringId === a.offeringId).length;
          const bCount = unlinkedBookings.filter(x => x.offeringId === b.offeringId).length;
          return aCount - bCount;
        }
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

  // Pre-process date data for Recharts area charts
  const overallChartData = dashboardStats?.chartData || [];
  
  return (
    <div className="space-y-6 p-4">
      {/* Removed Sub-tab Switcher Navigation because it is controlled by the router now */}

      {error && (
        <div className="p-3 bg-[#FCE8E6] text-[#C5221F] rounded-xl flex items-center gap-2 text-[10px] font-bold">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {currentSubTab === 'campaigns' ? (
        <>
          {/* Aggregate metrics ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatCard 
              label="Total Offerings" 
              value={loading ? <Skeleton className="h-6 w-12 my-0.5" /> : offerings.length} 
              icon={Calendar} 
              variant="info" 
              info="Total offerings created and active on Exly Creator profile." 
            />
            <StatCard 
              label="Unique Bookings" 
              value={statsLoading ? <Skeleton className="h-6 w-16 my-0.5" /> : (dashboardStats?.uniqueBookingsCount ?? 0)} 
              subValue={statsLoading ? undefined : `Total: ${dashboardStats?.totalBookingsCount ?? 0}`}
              icon={Database} 
              variant="mint" 
              info="De-duplicated bookings count across all campaign offerings." 
            />
            <StatCard 
              label="Unlinked Bookings" 
              value={unlinkedLoading ? <Skeleton className="h-6 w-16 my-0.5" /> : unlinkedBookings.length} 
              icon={ShieldAlert} 
              variant="apricot" 
              info="Exly bookings not linked to any CRM Lead by email/phone. Click to view and link." 
              onClick={() => setCurrentSubTab('unlinked')}
              className="cursor-pointer hover:scale-[1.01] transition-transform"
            />
            <StatCard 
              label="Aggregate Revenue" 
              value={loading ? <Skeleton className="h-6 w-24 my-0.5" /> : `₹ ${totalRevenueAll.toLocaleString()}`} 
              icon={IndianRupee} 
              variant="slate" 
              info="Accumulated revenue of client purchases through Exly." 
            />
          </div>

          {/* Recharts Overall Analytics Visuals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--color-bg-border)] pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  Revenue Over Time (Real-time Stream)
                </span>
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-pastel-mint-text)]">
                  <TrendingUp size={12} />
                  <span>₹</span>
                </div>
              </div>
              {statsLoading ? (
                <div className="h-48 w-full flex flex-col justify-between p-2">
                  <div className="flex items-end justify-between h-36 gap-2 pt-4">
                    {[...Array(12)].map((_, i) => (
                      <Skeleton 
                        key={i} 
                        className="w-full" 
                        height={`${15 + Math.sin(i) * 10 + Math.random() * 55}%`} 
                      />
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-[var(--color-bg-border)] pt-2">
                    <Skeleton width="40px" height="10px" />
                    <Skeleton width="40px" height="10px" />
                    <Skeleton width="40px" height="10px" />
                  </div>
                </div>
              ) : overallChartData.length === 0 ? (
                <div className="h-48 w-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  No revenue stream data recorded
                </div>
              ) : (
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
                      <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#81C995" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
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
              {statsLoading ? (
                <div className="h-48 w-full flex flex-col justify-between p-2">
                  <div className="flex items-end justify-between h-36 gap-2 pt-4">
                    {[...Array(12)].map((_, i) => (
                      <Skeleton 
                        key={i} 
                        className="w-full" 
                        height={`${10 + Math.cos(i) * 8 + Math.random() * 60}%`} 
                      />
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-[var(--color-bg-border)] pt-2">
                    <Skeleton width="40px" height="10px" />
                    <Skeleton width="40px" height="10px" />
                    <Skeleton width="40px" height="10px" />
                  </div>
                </div>
              ) : overallChartData.length === 0 ? (
                <div className="h-48 w-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  No transaction trend data recorded
                </div>
              ) : (
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
              )}
            </Card>
          </div>

          {/* Offerings Table with Sort/Filter Ribbon */}
          <Card className="p-0 overflow-hidden">
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
                    <option value="unlinked_desc">Unlinked Bookings: High to Low</option>
                    <option value="unlinked_asc">Unlinked Bookings: Low to High</option>
                    <option value="title_asc">Title: A to Z</option>
                    <option value="title_desc">Title: Z to A</option>
                  </select>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-bg-border)]/50 last:border-none">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="space-y-1.5">
                        <Skeleton width="180px" height="12px" />
                        <Skeleton width="100px" height="8px" />
                      </div>
                    </div>
                    <Skeleton width="60px" height="12px" />
                    <Skeleton width="50px" height="12px" />
                    <Skeleton width="80px" height="12px" />
                    <Skeleton width="80px" height="12px" />
                  </div>
                ))}
              </div>
            ) : filteredOfferings.length === 0 ? (
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
          {!statsLoading && dashboardStats?.recentBooking ? (
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
                  <p className="text-[var(--color-text-primary)] font-mono">₹ {dashboardStats.recentBooking.pricePaid?.toLocaleString() || 0}</p>
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
          ) : statsLoading ? (
            <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
              <div className="border-b border-[var(--color-bg-border)] pb-2 mb-3">
                <Skeleton width="220px" height="12px" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton width="80px" height="8px" />
                    <Skeleton width="120px" height="12px" />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : (
        /* Unlinked Bookings Page View */
        <Card className="p-0 overflow-hidden flex flex-col border border-[var(--color-bg-border)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-[var(--color-pastel-apricot-bg)] text-[var(--color-pastel-apricot-text)]">
                <ShieldAlert size={16} />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider">Unlinked CRM Bookings</h2>
                <p className="text-[9px] text-[var(--color-text-muted)] uppercase mt-0.5">
                  Selected {selectedUnlinkedIds.size} of {filteredUnlinked.length} filtered entries
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {linkMessage && (
                <span className="text-[10px] font-bold text-[var(--color-pastel-mint-text)] mr-2">
                  {linkMessage}
                </span>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={filteredUnlinked.length === 0 || linkingInProgress}
                onClick={handleLinkAllFiltered}
                className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]"
              >
                {linkingInProgress ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Database size={12} />
                    <span>Push All ({filteredUnlinked.length}) to CRM</span>
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={selectedUnlinkedIds.size === 0 || linkingInProgress}
                onClick={handleLinkSelected}
                className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]"
              >
                {linkingInProgress ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    <span>Linking {selectedUnlinkedIds.size} people...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={12} />
                    <span>Add {selectedUnlinkedIds.size} to CRM Leads</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search name, email, phone or offering..."
                value={unlinkedSearch}
                onChange={(e) => setUnlinkedSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md focus:border-[var(--color-action-primary)] outline-none text-[11px] font-semibold text-[var(--color-text-primary)] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Offering Dropdown Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Offering</span>
                <select
                  value={unlinkedOfferingFilter}
                  onChange={(e) => setUnlinkedOfferingFilter(e.target.value)}
                  className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md text-[11px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)] max-w-[200px] truncate"
                >
                  <option value="all">All Offerings</option>
                  {uniqueUnlinkedOfferings.map(offTitle => (
                    <option key={offTitle} value={offTitle}>
                      {offTitle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Sort Offering</span>
                <select
                  value={unlinkedSort}
                  onChange={(e) => setUnlinkedSort(e.target.value)}
                  className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md text-[11px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
                >
                  <option value="offering_asc">Offering: A to Z</option>
                  <option value="offering_desc">Offering: Z to A</option>
                  <option value="date_desc">Date: Newest First</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto bg-[var(--color-bg-surface)]">
            {unlinkedLoading ? (
              <div className="p-8 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-bg-border)]/50 last:border-none">
                    <Skeleton width="120px" height="12px" />
                    <Skeleton width="180px" height="12px" />
                    <Skeleton width="80px" height="12px" />
                    <Skeleton width="60px" height="12px" />
                  </div>
                ))}
              </div>
            ) : filteredUnlinked.length === 0 ? (
              <div className="p-12 text-center opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">No unlinked bookings found</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredUnlinked.length > 0 && selectedUnlinkedIds.size === filteredUnlinked.length}
                        onChange={toggleSelectAll}
                        className="rounded border-[var(--color-bg-border)] text-[var(--color-action-primary)] focus:ring-[var(--color-action-primary)]"
                      />
                    </th>
                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Client details</th>
                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Phone</th>
                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Offering Name</th>
                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Booked On</th>
                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] text-right">Price Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUnlinked.map((item) => {
                    const isSelected = selectedUnlinkedIds.has(item._id);
                    return (
                      <tr
                        key={item._id}
                        onClick={() => toggleSelectOne(item._id)}
                        className={`border-b border-[var(--color-bg-border)]/50 last:border-none hover:bg-[var(--color-bg-secondary)]/50 cursor-pointer transition-colors ${isSelected ? 'bg-[var(--color-bg-secondary)]/30' : ''}`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item._id)}
                            className="rounded border-[var(--color-bg-border)] text-[var(--color-action-primary)] focus:ring-[var(--color-action-primary)]"
                          />
                        </td>
                        <td className="p-3">
                          <div className="text-xs font-bold text-[var(--color-text-primary)]">{item.name}</div>
                          <div className="text-[9px] text-[var(--color-text-muted)] font-mono">{item.email || '—'}</div>
                        </td>
                        <td className="p-3 text-xs font-mono text-[var(--color-text-primary)]">{item.phone || '—'}</td>
                        <td className="p-3">
                          <div className="text-xs font-semibold text-[var(--color-text-primary)]">{item.offeringTitle}</div>
                          <div className="text-[9px] text-[var(--color-text-muted)] font-mono">ID: {item.offeringId}</div>
                        </td>
                        <td className="p-3 text-xs font-mono text-[var(--color-text-primary)]">
                          {item.bookedOn ? format(new Date(item.bookedOn), 'MMM dd yyyy, hh:mm a') : '—'}
                        </td>
                        <td className="p-3 text-xs font-mono font-bold text-[var(--color-text-primary)] text-right">
                          ₹ {item.pricePaid?.toLocaleString() || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Toolbar */}
          {!unlinkedLoading && filteredUnlinked.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] gap-3">
              <div className="flex items-center gap-4">
                <span>
                  Showing {Math.min(filteredUnlinked.length, (unlinkedPage - 1) * unlinkedRowsPerPage + 1)}–
                  {Math.min(filteredUnlinked.length, unlinkedPage * unlinkedRowsPerPage)} of {filteredUnlinked.length} entries
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={unlinkedRowsPerPage}
                    onChange={(e) => {
                      setUnlinkedRowsPerPage(Number(e.target.value));
                      setUnlinkedPage(1);
                    }}
                    className="px-1.5 py-0.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded text-[10px] font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={unlinkedPage === 1}
                  onClick={() => setUnlinkedPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 text-[10px]"
                >
                  Previous
                </Button>
                <span className="px-3 text-xs text-[var(--color-text-primary)] font-mono">
                  {unlinkedPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={unlinkedPage === totalPages}
                  onClick={() => setUnlinkedPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 text-[10px]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
                  {cohortLoading ? 'Loading...' : `INR ${cohortAnalytics?.avgLTV?.toLocaleString() || 0}`}
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
        {detailsError ? (
          <div className="p-4 bg-[#FCE8E6] text-[#C5221F] rounded-xl flex items-center gap-2 text-[10px] font-bold">
            <AlertCircle size={14} />
            <span>{detailsError}</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* The Five Analytical Counters with Part-by-part Skeleton Hydration */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <StatCard 
                label="Total Customers" 
                value={cohortLoading ? <Skeleton className="h-6 w-12 my-0.5" /> : (cohortAnalytics?.totalCustomers ?? 0)} 
                icon={Users} 
                variant="info" 
                info="Total unique customer contacts registered for this offering." 
              />
              <StatCard 
                label="New Customers" 
                value={cohortLoading ? <Skeleton className="h-6 w-12 my-0.5" /> : (cohortAnalytics?.newCustomers ?? 0)} 
                icon={UserPlus} 
                variant="mint" 
                info="Customers whose first-ever booking was this offering." 
              />
              <StatCard 
                label="Upsells" 
                value={cohortLoading ? <Skeleton className="h-6 w-12 my-0.5" /> : (cohortAnalytics?.upsells ?? 0)} 
                icon={ShoppingBag} 
                variant="apricot" 
                info="Customers who purchased this offering after buying another offering previously." 
              />
              <StatCard 
                label="Loyal Customers" 
                value={cohortLoading ? <Skeleton className="h-6 w-12 my-0.5" /> : (cohortAnalytics?.loyalCustomers ?? 0)} 
                icon={Heart} 
                variant="rose" 
                info="Customers of this offering who have 2 or more total purchases." 
              />
              <StatCard 
                label="Cohort LTV" 
                value={cohortLoading ? <Skeleton className="h-6 w-20 my-0.5" /> : `₹ ${(cohortAnalytics?.lifetimeValue ?? 0).toLocaleString()}`} 
                icon={IndianRupee} 
                variant="slate" 
                info="Aggregate lifetime value (LTV) across all offerings for the cohort of customers who purchased this offering." 
              />
            </div>

            {/* Campaign-level Charts with Part-by-part Skeleton Hydration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                <div className="border-b border-[var(--color-bg-border)] pb-2 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    Campaign Revenue Flow
                  </span>
                </div>
                {cohortLoading ? (
                  <div className="h-32 w-full flex items-end gap-1.5 p-2 pt-4">
                    {[...Array(10)].map((_, idx) => (
                      <Skeleton key={idx} className="w-full" height={`${20 + Math.sin(idx) * 15 + Math.random() * 40}%`} />
                    ))}
                  </div>
                ) : cohortChartData.length === 0 ? (
                  <div className="h-32 w-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    No revenue data recorded
                  </div>
                ) : (
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cohortChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                )}
              </Card>

              <Card className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                <div className="border-b border-[var(--color-bg-border)] pb-2 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    Campaign Booking Flow
                  </span>
                </div>
                {cohortLoading ? (
                  <div className="h-32 w-full flex items-end gap-1.5 p-2 pt-4">
                    {[...Array(10)].map((_, idx) => (
                      <Skeleton key={idx} className="w-full" height={`${25 + Math.cos(idx) * 10 + Math.random() * 35}%`} />
                    ))}
                  </div>
                ) : cohortChartData.length === 0 ? (
                  <div className="h-32 w-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    No booking data recorded
                  </div>
                ) : (
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cohortChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                )}
              </Card>
            </div>

            {/* Customers List Section with Part-by-part Skeleton Hydration */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    Registered Customers List & CRM Lead Checks
                  </h3>
                  <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
                    {detailsLoading ? 'Loading registered bookings...' : `Showing ${filteredBookings.length} of ${details?.bookings?.length ?? 0} total customer bookings`}
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
                    disabled={detailsLoading}
                  />
                </div>
              </div>

              <div className="overflow-hidden bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                {detailsLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-bg-border)]/50 last:border-none">
                        <div className="space-y-1.5">
                          <Skeleton width="120px" height="12px" />
                          <Skeleton width="180px" height="8px" />
                        </div>
                        <Skeleton width="80px" height="12px" />
                        <Skeleton width="100px" height="12px" />
                        <Skeleton width="80px" height="12px" />
                      </div>
                    ))}
                  </div>
                ) : filteredBookings.length === 0 ? (
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
        )}
      </FullScreenWorkspace>
    </div>
  );
};

export default ExlyDataContent;
