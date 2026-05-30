import React from 'react';
import axios from 'axios';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card, Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';

export default function ClaimWorkspaceBanner({ artistId, shareToken, onClaimed }) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [claimed, setClaimed] = React.useState(false);

  if (!shareToken || claimed) return null;

  const alreadyOnTeam = user && artistId;

  const handleClaim = async () => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setLoading(true);
    try {
      await axios.post(`/api/artists/${artistId}/claim`, { token: shareToken });
      setClaimed(true);
      onClaimed?.();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-500">
          <Sparkles size={20} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Claim Your Workspace</h3>
          <p className="text-xs text-slate-500">Link this dashboard to your account to manage connections and stats.</p>
        </div>
      </div>
      {!alreadyOnTeam ? (
        <Button onClick={handleClaim} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {user ? 'Claim Workspace' : 'Sign in to Claim'}
        </Button>
      ) : (
        <span className="text-xs font-bold text-emerald-500">You have access</span>
      )}
    </Card>
  );
}
