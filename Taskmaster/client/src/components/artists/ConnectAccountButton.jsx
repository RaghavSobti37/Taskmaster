import React from 'react';
import axios from 'axios';
import { LogIn, Loader2 } from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTwitch } from 'react-icons/fa';
import { Button } from '../ui';
import { byId } from '../../config/integrations.config';

const ICONS = {
  spotify: FaSpotify,
  youtube: FaYoutube,
  instagram: FaInstagram,
  facebook: FaFacebook,
  tiktok: FaTiktok,
  twitch: FaTwitch,
};

const COLOR_MAP = {
  spotify: 'from-emerald-500 to-green-600 shadow-emerald-500/20',
  youtube: 'from-red-500 to-rose-600 shadow-red-500/20',
  instagram: 'from-pink-500 to-rose-500 shadow-pink-500/20',
  facebook: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
};

export default function ConnectAccountButton({ provider, artistId, label, variant = 'primary', className = '' }) {
  const [loading, setLoading] = React.useState(false);
  const config = byId(provider);
  const Icon = ICONS[provider] || LogIn;

  const handleConnect = async () => {
    if (!artistId) return alert('Artist ID missing');
    if (!config?.hasOAuth) {
      alert(`${config?.name || provider} OAuth coming soon. Add platform IDs in Edit.`);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`/api/auth/connect/${provider}`, { artistId });
      if (data?.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      throw new Error('No auth URL returned');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Connection failed');
      setLoading(false);
    }
  };

  const gradient = COLOR_MAP[provider] || 'from-slate-600 to-slate-700 shadow-slate-500/20';
  const text = label || (loading ? 'Connecting…' : `Connect ${config?.name || provider}`);

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 disabled:opacity-60 ${className}`}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
        {text}
      </button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleConnect}
      disabled={loading}
      className={`bg-gradient-to-r ${gradient} text-white border-0 ${className}`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {text}
    </Button>
  );
}
