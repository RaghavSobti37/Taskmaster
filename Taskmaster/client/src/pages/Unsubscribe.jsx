import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { UserX } from 'lucide-react';
import { LoadingText } from '../components/ui';
import { usePublicEmailStreams } from '../hooks/useTaskmasterQueries';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const campaignId = searchParams.get('campaignId') || '';
  const recipientId = searchParams.get('recipientId') || '';
  const tokenParam = searchParams.get('token') || '';
  const streamParam = searchParams.get('stream') || searchParams.get('streamSlug') || '';

  const { data: streams = [] } = usePublicEmailStreams();
  const streamMeta = useMemo(
    () => streams.find((s) => s.slug === streamParam),
    [streams, streamParam],
  );

  const [email, setEmail] = useState(emailParam);
  const [reason, setReason] = useState('Too frequent');
  const [scope, setScope] = useState(streamParam ? 'stream' : 'all');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const options = ['Too frequent', 'Content no longer relevant', 'Spam behavior', 'Other'];

  const submitUnsubscribe = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      await axios.post('/api/track/unsubscribe', {
        email,
        reason,
        campaignId,
        recipientId,
        token: tokenParam,
        stream: scope === 'stream' ? streamParam : undefined,
        streamSlug: scope === 'stream' ? streamParam : undefined,
        unsubscribeAll: scope === 'all',
      });
      setStatus({ success: true, scope, streamName: streamMeta?.name });
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setStatus({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  if (status?.success) {
    const streamLabel = status.streamName || streamParam || 'this list';
    return (
      <div className="min-h-screen bg-[#0b0f19] text-[#f1f5f9] flex items-center justify-center p-4 font-sans">
        <div className="bg-[#111827] border border-[#1f2937] p-8 md:p-12 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl mx-auto flex items-center justify-center">
            <UserX size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black uppercase tracking-tight text-white">Unsubscription Confirmed</h1>
            <p className="text-xs text-[#94a3b8] font-mono leading-relaxed">
              {status.scope === 'all' ? (
                <>Your email <strong className="text-white">{email}</strong> has been unsubscribed from <strong className="text-white">all</strong> our mailing lists.</>
              ) : (
                <>Your email <strong className="text-white">{email}</strong> has been unsubscribed from <strong className="text-white">{streamLabel}</strong> only. You may still receive other emails from us.</>
              )}
            </p>
          </div>
          <div className="pt-4 border-t border-[#1f2937]">
            <a href="https://theshakticollective.in" className="inline-block text-xs font-black uppercase tracking-widest text-[#38bdf8] hover:underline">
              Return to Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f1f5f9] flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111827] border border-[#1f2937] p-8 md:p-10 rounded-3xl max-w-md w-full space-y-8 shadow-2xl">
        <div className="flex items-center gap-3 pb-6 border-b border-[#1f2937]">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-black">
            <UserX size={20} />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-white">Communication Preferences</h2>
            <p className="text-[10px] text-[#94a3b8] font-mono uppercase tracking-widest">Unsubscribe Center</p>
          </div>
        </div>

        {streamParam && streamMeta && (
          <p className="text-xs text-[#94a3b8] font-mono">
            You received this from: <strong className="text-white">{streamMeta.name}</strong> ({streamMeta.domain})
          </p>
        )}

        <form onSubmit={submitUnsubscribe} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] block">Confirm Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@domain.com"
              className="w-full px-4 py-3 bg-[#0b0f19] border border-[#1f2937] rounded-xl text-xs font-mono outline-none focus:border-[#38bdf8] text-white transition-all"
            />
          </div>

          {streamParam && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] block">Unsubscribe scope</label>
              <label className="flex items-center gap-3 p-3 bg-[#0b0f19]/50 border border-[#1f2937] rounded-xl cursor-pointer hover:border-[#38bdf8]/50 transition-all">
                <input type="radio" name="scope" value="stream" checked={scope === 'stream'} onChange={() => setScope('stream')} className="accent-[#38bdf8]" />
                <span className="text-xs font-mono text-[#cbd5e1]">
                  Only <strong>{streamMeta?.name || streamParam}</strong> emails
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-[#0b0f19]/50 border border-[#1f2937] rounded-xl cursor-pointer hover:border-[#38bdf8]/50 transition-all">
                <input type="radio" name="scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} className="accent-[#38bdf8]" />
                <span className="text-xs font-mono text-[#cbd5e1]">All emails from The Shakti Collective</span>
              </label>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] block">Please let us know your reason</label>
            <div className="space-y-2">
              {options.map((opt) => (
                <label key={opt} className="flex items-center gap-3 p-3 bg-[#0b0f19]/50 border border-[#1f2937] rounded-xl cursor-pointer hover:border-[#38bdf8]/50 transition-all">
                  <input
                    type="radio"
                    name="reason"
                    value={opt}
                    checked={reason === opt}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-[#38bdf8]"
                  />
                  <span className="text-xs font-mono text-[#cbd5e1]">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {status?.error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono text-center">
              {status.error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
          >
            {loading ? <LoadingText className="text-white" spinnerSize="sm">Processing...</LoadingText> : 'Confirm Unsubscribe'}
          </button>
        </form>

        <div className="pt-6 border-t border-[#1f2937] text-center">
          <p className="text-[10px] font-mono text-[#64748b]">
            {streamParam ? 'Stream-only unsub keeps other lists active.' : 'You will be unsubscribed from all lists.'}
          </p>
        </div>
      </div>
    </div>
  );
}
