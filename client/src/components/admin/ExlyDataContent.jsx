import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, RefreshCw, Key, ShieldAlert, Award, AlertCircle, CheckCircle2,
  TrendingUp, DollarSign, Calendar, Percent
} from 'lucide-react';
import { Badge, Card, StatCard, DataTable, Button, ProgressBar } from '../ui';
import { format } from 'date-fns';

const ExlyDataContent = () => {
  const [offerings, setOfferings] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchStatusAndData();
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError('');
    try {
      await axios.post('/api/exly/sync');
      await fetchStatusAndData();
    } catch (err) {
      setError(err.response?.data?.error || 'Exly API Sync Execution Failed.');
    } finally {
      setSyncing(false);
    }
  };

  const columns = [
    {
      header: 'Offering Name',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] shrink-0">
            {item.title?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">{item.title}</span>
              <Badge variant={item.status === 'active' ? 'mint' : 'warning'} className="!text-[9px] uppercase tracking-wider">
                {item.status}
              </Badge>
            </div>
            <span className="text-[9px] text-[var(--color-text-muted)] font-mono">ID: {item.offeringId}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Price',
      render: (item) => (
        <span className="text-xs font-mono font-bold">
          {item.currency} {item.price.toLocaleString()}
        </span>
      )
    },
    {
      header: 'Total Bookings',
      render: (item) => (
        <span className="text-xs font-bold">{item.totalBookings}</span>
      )
    },
    {
      header: 'Conversion Rate',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold">{item.conversionRate}%</span>
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

  // Calculate totals from offerings list for aggregate ribbon
  const totalRevenueAll = offerings.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalBookingsAll = offerings.reduce((acc, curr) => acc + curr.totalBookings, 0);
  const avgConversionAll = offerings.length > 0
    ? (offerings.reduce((acc, curr) => acc + curr.conversionRate, 0) / offerings.length).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div className="p-8 text-center opacity-40">
        <RefreshCw className="animate-spin mx-auto mb-2 text-[var(--color-text-muted)]" size={24} />
        <p className="text-[10px] font-black uppercase tracking-widest">Hydrating Exly Credentials & Listings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Configuration Status Banner */}
      <Card className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${config?.connected ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#FCE8E6] text-[#C5221F]'}`}>
              {config?.connected ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-widest">Exly API Pipeline</h4>
                <Badge variant={config?.connected ? 'success' : 'rose'}>
                  {config?.connected ? 'CONNECTED & UP TO DATE' : 'NOT CONNECTED'}
                </Badge>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {config?.connected 
                  ? `Authorized using Exly endpoint key ${config.apiKeyObfuscated} on target: ${config.apiUrl}` 
                  : 'Add EXLY_API_KEY and EXLY_API_URL keys in your server config (.env) to query real-time offerings.'
                }
              </p>
            </div>
          </div>
          <div>
            <Button 
              variant={config?.connected ? 'primary' : 'secondary'}
              disabled={syncing || !config?.connected} 
              onClick={handleManualSync}
              className="w-full md:w-auto"
            >
              <RefreshCw size={14} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'SYNCING DATA...' : 'SYNC EXLY DATA'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-[#FCE8E6] text-[#C5221F] rounded-xl flex items-center gap-2 text-[10px] font-bold">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </Card>

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
          label="Avg Conversion" 
          value={`${avgConversionAll}%`} 
          icon={Percent} 
          variant="apricot" 
          info="Average conversion rate of leads into Converted clients." 
        />
        <StatCard 
          label="Aggregate Revenue" 
          value={`INR ${totalRevenueAll.toLocaleString()}`} 
          icon={DollarSign} 
          variant="slate" 
          info="Accumulated revenue of client purchases through Exly." 
        />
      </div>

      {/* Offerings Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <h3 className="text-[10px] font-black uppercase tracking-widest">Active Offerings Performance</h3>
        </div>
        
        {offerings.length === 0 ? (
          <div className="p-12 text-center opacity-30">
            <p className="text-[10px] font-black uppercase tracking-widest">No Exly Offerings Synced Yet</p>
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={offerings} 
          />
        )}
      </Card>
    </div>
  );
};

export default ExlyDataContent;
