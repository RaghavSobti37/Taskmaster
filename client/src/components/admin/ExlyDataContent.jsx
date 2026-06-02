import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Database, RefreshCw, ShieldAlert, AlertCircle,
  IndianRupee, Users, Search,
  SlidersHorizontal, BarChart3, TrendingUp, UserPlus
} from 'lucide-react';
import { Badge, Card, DataTable, Button, FullScreenWorkspace, Input, Skeleton } from '../ui';
import UsdInrAmountFields from '../finance/UsdInrAmountFields';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { inrToUsd } from '../../utils/usdInr';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid } from 'recharts';
import {
  shortenOfferingTitle,
  shortenOfferingTitleCompact,
  formatInr,
  formatPercent,
  computeOfferingTotals
} from '../../utils/exlyFormatters';

const exlyChartTooltipFormatter = (value, name) => {
  if (/revenue|rev/i.test(String(name))) return [formatInr(value), name];
  if (/booking/i.test(String(name))) return [String(Math.round(Number(value))), name];
  return [value, name];
};

const MetricBlock = ({ label, value, tone = 'default', title }) => {
  const toneClass = {
    mint: 'text-[var(--color-pastel-mint-text)]',
    rose: 'text-[var(--color-pastel-rose-text)]',
    muted: 'text-[var(--color-text-muted)]',
    default: 'text-[var(--color-text-primary)]'
  }[tone] || 'text-[var(--color-text-primary)]';

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-lg font-black font-mono tabular-nums leading-tight mt-0.5 ${toneClass}`} title={title}>
        {value}
      </p>
    </div>
  );
};

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
  const [editedPriceUsd, setEditedPriceUsd] = useState('');
  const [editedType, setEditedType] = useState('program');
  const [editedStatus, setEditedStatus] = useState('active');
  const [editedEventDate, setEditedEventDate] = useState('');
  const [editedEventTime, setEditedEventTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Search Filter for campaign customers
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingPaymentFilter, setBookingPaymentFilter] = useState('all');
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingRowsPerPage, setBookingRowsPerPage] = useState(25);
  const [detailsPagination, setDetailsPagination] = useState(null);
  const [offeringMetrics, setOfferingMetrics] = useState(null);

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

  useEffect(() => {
    setBookingPage(1);
  }, [searchQuery, bookingPaymentFilter]);

  const unlinkedCountByOffering = useMemo(() => {
    const map = new Map();
    unlinkedBookings.forEach((booking) => {
      map.set(booking.offeringId, (map.get(booking.offeringId) || 0) + 1);
    });
    return map;
  }, [unlinkedBookings]);

  const offeringTotals = useMemo(() => computeOfferingTotals(offerings), [offerings]);

  const { data: rateData } = useUsdInrRate({ enabled: workspaceOpen });
  const usdInrRate = rateData?.rate;

  useEffect(() => {
    if (!workspaceOpen || !editedPrice) return;
    if (!Number.isFinite(usdInrRate) || usdInrRate <= 0) return;
    setEditedPriceUsd((prev) => (prev === '' ? String(inrToUsd(editedPrice, usdInrRate)) : prev));
  }, [workspaceOpen, usdInrRate, editedPrice]);

  const fetchOfferingDetails = useCallback(async (offeringId, page = 1, limit = bookingRowsPerPage, paymentFilter = bookingPaymentFilter, search = searchQuery) => {
    setDetailsLoading(true);
    setDetailsError('');
    try {
      const res = await axios.get(`/api/exly/offerings/${offeringId}`, {
        params: { page, limit, paymentFilter, search: search.trim() || undefined }
      });
      setDetails(res.data);
      setOfferingMetrics(res.data.metrics || null);
      setDetailsPagination(res.data.pagination || null);
      setEditedTitle(res.data.offering.title || '');
      setEditedPrice(res.data.offering.price || 0);
      setEditedPriceUsd('');
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
  }, [bookingRowsPerPage, bookingPaymentFilter, searchQuery]);

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
    setCohortLoading(true);
    setDetailsError('');
    setDetails(null);
    setCohortAnalytics(null);
    setCohortChartData([]);
    setOfferingMetrics(null);
    setDetailsPagination(null);
    setSearchQuery('');
    setBookingPaymentFilter('all');
    setBookingPage(1);

    setEditedTitle(offering.title || '');
    setEditedPrice(offering.price || 0);
    setEditedPriceUsd('');
    setEditedType(offering.type || 'program');
    setEditedStatus(offering.status || 'active');
    setEditedEventDate(offering.eventDate || '');
    setEditedEventTime(offering.eventTime || '');

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

  useEffect(() => {
    if (!workspaceOpen || !selectedOffering?.offeringId) return;
    const timer = setTimeout(() => {
      fetchOfferingDetails(selectedOffering.offeringId, bookingPage, bookingRowsPerPage, bookingPaymentFilter, searchQuery);
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [workspaceOpen, selectedOffering?.offeringId, bookingPage, bookingRowsPerPage, bookingPaymentFilter, searchQuery, fetchOfferingDetails]);

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
      header: 'Offering',
      render: (item) => (
        <div className="flex items-center gap-2.5 max-w-[220px]">
          <div className="w-7 h-7 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[9px] shrink-0 text-[var(--color-text-primary)]">
            {item.title?.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span
              className="font-semibold text-xs text-[var(--color-text-primary)] truncate block"
              title={item.title}
            >
              {shortenOfferingTitleCompact(item.title)}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant={item.status === 'active' ? 'success' : 'warning'} className="!text-[8px] uppercase tracking-wider shrink-0">
                {item.status}
              </Badge>
              {(item.eventDate || item.eventTime) && (
                <span className="text-[8px] text-[var(--color-text-muted)] font-mono truncate">
                  {item.eventDate} {item.eventTime}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'List Price',
      render: (item) => (
        <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
          ₹ {formatInr(item.price, { exact: true })}
        </span>
      )
    },
    {
      header: 'Paid',
      render: (item) => (
        <span className="text-xs font-bold text-[var(--color-pastel-mint-text)] bg-[var(--color-pastel-mint-bg)] px-1.5 py-0.5 rounded font-mono">
          {item.paidBookings ?? 0}
        </span>
      )
    },
    {
      header: 'Free',
      render: (item) => (
        <span className="text-xs font-bold text-[var(--color-pastel-rose-text)] bg-[var(--color-pastel-rose-bg)] px-1.5 py-0.5 rounded font-mono">
          {item.freeBookings ?? 0}
        </span>
      )
    },
    {
      header: 'Revenue',
      render: (item) => (
        <span className="text-xs font-bold font-mono text-[var(--color-text-primary)]">
          ₹ {formatInr(item.totalRevenue, { exact: true })}
        </span>
      )
    },
    {
      header: 'Conv. Rate',
      render: (item) => (
        <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
          {formatPercent(item.conversionRate || 0)}
        </span>
      )
    },
    {
      header: 'Unlinked',
      render: (item) => {
        const count = unlinkedCountByOffering.get(item.offeringId) || 0;
        return (
          <div className="flex items-center gap-1.5 font-bold">
            {count > 0 ? (
              <span className="text-xs font-mono text-[var(--color-pastel-rose-text)] bg-[var(--color-pastel-rose-bg)] px-1.5 py-0.5 rounded flex items-center gap-1">
                <ShieldAlert size={10} />
                {count}
              </span>
            ) : (
              <span className="text-xs font-mono text-[var(--color-pastel-mint-text)] bg-[var(--color-pastel-mint-bg)] px-1.5 py-0.5 rounded">
                0
              </span>
            )}
          </div>
        );
      }
    }
  ];

  const bookingColumns = [
    {
      header: 'Customer',
      render: (b) => (
        <div>
          <div className="font-bold text-xs text-[var(--color-text-primary)]">{b.name}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] font-mono">{b.email || '—'}</div>
        </div>
      )
    },
    {
      header: 'Phone',
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
      header: 'Type',
      render: (b) => (
        <Badge
          variant={b.isPaid ? 'success' : 'rose'}
          className="!text-[9px] uppercase tracking-wider"
        >
          {b.isPaid ? 'Paid' : 'Free'}
        </Badge>
      )
    },
    {
      header: 'Price Paid',
      render: (b) => (
        <span className={`text-xs font-bold font-mono ${b.isPaid ? 'text-[var(--color-pastel-mint-text)]' : 'text-[var(--color-text-muted)]'}`}>
          ₹ {formatInr(b.pricePaid, { exact: true })}
        </span>
      )
    },
    {
      header: 'Payment',
      render: (b) => (
        <span className="text-[9px] font-mono text-[var(--color-text-muted)] uppercase">
          {b.paymentType || (b.isPaid ? 'Paid' : 'Free')}
        </span>
      )
    },
    {
      header: 'CRM',
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
    }
  ];

  // Filter and Sort offerings list
  const filteredOfferings = useMemo(() => offerings
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
        case 'paid_desc': return (b.paidBookings || 0) - (a.paidBookings || 0);
        case 'free_desc': return (b.freeBookings || 0) - (a.freeBookings || 0);
        case 'unlinked_desc': {
          const aCount = unlinkedCountByOffering.get(a.offeringId) || 0;
          const bCount = unlinkedCountByOffering.get(b.offeringId) || 0;
          return bCount - aCount;
        }
        case 'unlinked_asc': {
          const aCount = unlinkedCountByOffering.get(a.offeringId) || 0;
          const bCount = unlinkedCountByOffering.get(b.offeringId) || 0;
          return aCount - bCount;
        }
        case 'title_asc': return a.title.localeCompare(b.title);
        case 'title_desc': return b.title.localeCompare(a.title);
        default: return b.totalRevenue - a.totalRevenue;
      }
    }), [offerings, offeringSearch, statusFilter, typeFilter, sortBy, unlinkedCountByOffering]);

  const workspaceBookings = details?.bookings || [];

  const overallChartData = dashboardStats?.chartData || [];
  const displayRevenue = dashboardStats?.totalRevenue ?? offeringTotals.totalRevenue;
  const displayPaidBookings = dashboardStats?.paidBookingsCount ?? offeringTotals.paidBookings;
  const displayFreeBookings = dashboardStats?.freeBookingsCount ?? offeringTotals.freeBookings;
  const displayAov = dashboardStats?.avgOrderValue ?? (
    displayPaidBookings > 0 ? displayRevenue / displayPaidBookings : 0
  );
  const displayTotalBookings = dashboardStats?.totalBookingsCount ?? (
    displayPaidBookings + displayFreeBookings
  );
  
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
          {/* Summary — 3 grouped panels instead of 8 cramped cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-bg-border)]">
                <Database size={14} className="text-[var(--color-text-muted)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Bookings</span>
              </div>
              {statsLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <MetricBlock label="Paid" value={displayPaidBookings.toLocaleString('en-IN')} tone="mint" />
                  <MetricBlock label="Free" value={displayFreeBookings.toLocaleString('en-IN')} tone="rose" />
                  <MetricBlock label="All rows" value={displayTotalBookings.toLocaleString('en-IN')} tone="muted" />
                </div>
              )}
            </Card>

            <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-bg-border)]">
                <IndianRupee size={14} className="text-[var(--color-text-muted)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Revenue</span>
              </div>
              {statsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : (
                <div className="space-y-2">
                  <p
                    className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[var(--color-text-primary)] leading-none"
                    title={`₹ ${formatInr(displayRevenue, { exact: true })}`}
                  >
                    ₹ {formatInr(displayRevenue, { exact: true })}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Avg order{' '}
                    <span className="font-mono text-[var(--color-text-primary)]">
                      ₹ {formatInr(displayAov, { exact: true })}
                    </span>
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-bg-border)]">
                <Users size={14} className="text-[var(--color-text-muted)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Overview</span>
              </div>
              {statsLoading || loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <MetricBlock
                    label="Unique customers"
                    value={(dashboardStats?.uniqueBookingsCount ?? 0).toLocaleString('en-IN')}
                  />
                  <MetricBlock label="Offerings" value={offerings.length.toLocaleString('en-IN')} />
                  <MetricBlock label="Conversion" value={formatPercent(dashboardStats?.avgConversionRate ?? 0)} />
                  <button
                    type="button"
                    onClick={() => setCurrentSubTab('unlinked')}
                    className="text-left rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors -m-1 p-1"
                  >
                    <MetricBlock
                      label="Unlinked"
                      value={unlinkedBookings.length.toLocaleString('en-IN')}
                      tone="rose"
                    />
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* Recharts Overall Analytics Visuals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--color-bg-border)] pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  Revenue Over Time
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
                        formatter={exlyChartTooltipFormatter}
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
                        formatter={exlyChartTooltipFormatter}
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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Campaigns</h3>
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
                    <option value="paid_desc">Paid: High to Low</option>
                    <option value="free_desc">Free: High to Low</option>
                    <option value="unlinked_desc">Unlinked: High to Low</option>
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
                  <p className="text-[var(--color-text-primary)] font-mono">
                    ₹ {formatInr(dashboardStats.recentBooking.pricePaid, { exact: true })}
                    {Number(dashboardStats.recentBooking.pricePaid || 0) <= 0 && (
                      <Badge variant="rose" className="ml-2 !text-[8px]">Free</Badge>
                    )}
                  </p>
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
                          <div className="text-xs font-semibold text-[var(--color-text-primary)]" title={item.offeringTitle}>
                            {shortenOfferingTitle(item.offeringTitle)}
                          </div>
                          <div className="text-[9px] text-[var(--color-text-muted)] font-mono">{item.offeringId}</div>
                        </td>
                        <td className="p-3 text-xs font-mono text-[var(--color-text-primary)]">
                          {item.bookedOn ? format(new Date(item.bookedOn), 'MMM dd yyyy, hh:mm a') : '—'}
                        </td>
                        <td className="p-3 text-xs font-mono font-bold text-[var(--color-text-primary)] text-right">
                          ₹ {formatInr(item.pricePaid, { exact: true })}
                          {Number(item.pricePaid || 0) <= 0 && (
                            <span className="block text-[8px] uppercase text-[var(--color-pastel-rose-text)]">Free</span>
                          )}
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

                <UsdInrAmountFields
                  enabled={workspaceOpen}
                  inrLabel="Base Price (INR)"
                  inrValue={editedPrice === 0 ? '' : String(editedPrice)}
                  usdValue={editedPriceUsd}
                  onInrChange={(value) => setEditedPrice(Number(value) || 0)}
                  onUsdChange={setEditedPriceUsd}
                  layout="stack"
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

                <span className="text-[var(--color-text-muted)]">Avg Order Value:</span>
                <span className="text-right font-mono text-[var(--color-pastel-mint-text)]">
                  {offeringMetrics ? `₹ ${formatInr(offeringMetrics.avgOrderValue, { exact: true })}` : '—'}
                </span>

                <span className="text-[var(--color-text-muted)]">Conversion Rate:</span>
                <span className="text-right font-mono text-[var(--color-text-primary)]">
                  {formatPercent(offeringMetrics?.conversionRate || details?.offering?.conversionRate || 0)}
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
            {/* Offering summary — grouped panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3 pb-2 border-b border-[var(--color-bg-border)]">Bookings</p>
                {detailsLoading ? (
                  <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <MetricBlock label="Paid" value={(offeringMetrics?.paidBookings ?? 0).toLocaleString('en-IN')} tone="mint" />
                    <MetricBlock label="Free" value={(offeringMetrics?.freeBookings ?? 0).toLocaleString('en-IN')} tone="rose" />
                    <MetricBlock label="Total" value={(offeringMetrics?.totalBookings ?? 0).toLocaleString('en-IN')} tone="muted" />
                  </div>
                )}
              </Card>
              <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3 pb-2 border-b border-[var(--color-bg-border)]">Revenue</p>
                {detailsLoading ? (
                  <div className="space-y-2"><Skeleton className="h-8 w-36" /><Skeleton className="h-4 w-24" /></div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xl font-black font-mono tabular-nums text-[var(--color-text-primary)]">
                      ₹ {formatInr(offeringMetrics?.totalRevenue ?? 0, { exact: true })}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Avg order <span className="font-mono text-[var(--color-text-primary)]">₹ {formatInr(offeringMetrics?.avgOrderValue ?? 0, { exact: true })}</span>
                    </p>
                  </div>
                )}
              </Card>
              <Card className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3 pb-2 border-b border-[var(--color-bg-border)]">Customers</p>
                {detailsLoading || cohortLoading ? (
                  <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <MetricBlock label="Unique" value={(cohortAnalytics?.totalCustomers ?? 0).toLocaleString('en-IN')} />
                    <MetricBlock label="Conversion" value={formatPercent(offeringMetrics?.conversionRate ?? 0)} />
                    <MetricBlock label="New" value={(cohortAnalytics?.newCustomers ?? 0).toLocaleString('en-IN')} />
                    <MetricBlock label="Loyal" value={(cohortAnalytics?.loyalCustomers ?? 0).toLocaleString('en-IN')} />
                  </div>
                )}
              </Card>
            </div>

            {/* Cohort extras — single compact row */}
            {!cohortLoading && cohortAnalytics && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                <span>Upsells: <span className="font-mono text-[var(--color-text-primary)]">{cohortAnalytics.upsells ?? 0}</span></span>
                <span>Cohort LTV: <span className="font-mono text-[var(--color-text-primary)]">₹ {formatInr(cohortAnalytics.lifetimeValue ?? 0, { exact: true })}</span></span>
                <span>Avg LTV: <span className="font-mono text-[var(--color-text-primary)]">₹ {formatInr(cohortAnalytics.avgLTV ?? 0, { exact: true })}</span></span>
              </div>
            )}

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
                          formatter={exlyChartTooltipFormatter}
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
                          formatter={exlyChartTooltipFormatter}
                        />
                        <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#FDD663" fillOpacity={1} fill="url(#colorCampBooks)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            {/* Customers List Section */}
            <div className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    Booking Records
                  </h3>
                  <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
                    {detailsLoading
                      ? 'Loading bookings...'
                      : `Page ${detailsPagination?.page ?? 1} · ${workspaceBookings.length} shown · ${detailsPagination?.total ?? 0} total (${bookingPaymentFilter})`}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-1 p-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-md">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'paid', label: 'Paid' },
                      { key: 'free', label: 'Free' }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBookingPaymentFilter(key)}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                          bookingPaymentFilter === key
                            ? key === 'paid'
                              ? 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]'
                              : key === 'free'
                                ? 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)]'
                                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {label}
                        {!detailsLoading && offeringMetrics && (
                          <span className="ml-1 font-mono opacity-70">
                            ({key === 'all'
                              ? offeringMetrics.totalBookings
                              : key === 'paid'
                                ? offeringMetrics.paidBookings
                                : offeringMetrics.freeBookings})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search name, email, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none text-xs font-semibold text-[var(--color-text-primary)] transition-all"
                      disabled={detailsLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Segment summary — inline, not duplicate cards */}
              {!detailsLoading && offeringMetrics && (
                <div className="flex flex-wrap gap-4 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-[var(--color-pastel-mint-text)]">
                    Paid segment: <span className="font-mono text-[var(--color-text-primary)]">{offeringMetrics.paidBookings}</span>
                    {' · '}₹ {formatInr(offeringMetrics.paidRevenue ?? offeringMetrics.totalRevenue, { exact: true })}
                  </span>
                  <span className="text-[var(--color-pastel-rose-text)]">
                    Free segment: <span className="font-mono text-[var(--color-text-primary)]">{offeringMetrics.freeBookings}</span>
                  </span>
                </div>
              )}

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
                ) : workspaceBookings.length === 0 ? (
                  <div className="p-12 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">No matching customer bookings</p>
                  </div>
                ) : (
                  <DataTable
                    columns={bookingColumns}
                    data={workspaceBookings}
                  />
                )}
              </div>

              {!detailsLoading && detailsPagination && detailsPagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] gap-3">
                  <div className="flex items-center gap-4">
                    <span>
                      Page {detailsPagination.page} of {detailsPagination.totalPages} · {detailsPagination.total} bookings
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>Show</span>
                      <select
                        value={bookingRowsPerPage}
                        onChange={(e) => {
                          setBookingRowsPerPage(Number(e.target.value));
                          setBookingPage(1);
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
                      disabled={bookingPage <= 1}
                      onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 text-[10px]"
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={bookingPage >= detailsPagination.totalPages}
                      onClick={() => setBookingPage((p) => p + 1)}
                      className="px-2.5 py-1 text-[10px]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </FullScreenWorkspace>
    </div>
  );
};

export default ExlyDataContent;
