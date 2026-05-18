import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Disc, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui';

export default function MetaOAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying Meta authorization credentials...');
  const [error, setError] = useState('');
  const [artistId, setArtistId] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code) {
        setError('Authorization code missing from redirect URL.');
        return;
      }
      if (!state) {
        setError('Artist ID (state) missing from redirect URL.');
        return;
      }

      setArtistId(state);

      try {
        const redirectUri = `${window.location.origin}/oauth/meta/callback`;
        setStatus('Securely exchanging authorization code for 60-day permanent user token & discovering linked accounts...');
        
        await axios.post(`/api/artists/${state}/auth/meta/callback`, {
          code,
          redirectUri
        });

        setStatus('Successfully connected! Redirecting back to artist workspace...');
        setTimeout(() => {
          navigate(`/artists/${state}?connected=meta`);
        }, 1500);

      } catch (err) {
        console.error('Meta OAuth callback error:', err);
        setError(err.response?.data?.message || err.message || 'Failed to authenticate with Meta.');
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#111827] p-8 rounded-3xl border border-[#1F2937] text-center shadow-2xl space-y-6">
        {error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-rose-500">Meta Connection Failed</h2>
            <p className="text-xs text-slate-400 font-mono">{error}</p>
            {artistId ? (
              <Button variant="secondary" className="w-full" onClick={() => navigate(`/artists/${artistId}`)}>
                Return to Workspace
              </Button>
            ) : (
              <Button variant="secondary" className="w-full" onClick={() => navigate('/artists')}>
                Return to Roster
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/20 text-pink-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Disc size={32} className="animate-spin" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">Connecting Meta Account</h2>
            <p className="text-xs text-slate-400 font-mono">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
