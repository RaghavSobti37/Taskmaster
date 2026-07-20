import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ExternalLink, UserX } from 'lucide-react';
import { buildAutoMailerUrl } from '../utils/autoMailerUrl';

export default function UnsubscribePage() {
  const location = useLocation();
  const autoMailerUrl = useMemo(
    () => buildAutoMailerUrl(`/unsubscribe${location.search || ''}`),
    [location.search],
  );

  useEffect(() => {
    window.location.replace(autoMailerUrl);
  }, [autoMailerUrl]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f1f5f9] flex items-center justify-center p-4 font-sans">
      <div className="bg-[#111827] border border-[#1f2937] p-8 md:p-10 rounded-3xl max-w-md w-full space-y-6 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mx-auto flex items-center justify-center">
          <UserX size={26} />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-white">Unsubscribe moved</h1>
          <p className="mt-2 text-xs text-[#94a3b8] font-mono leading-relaxed">
            Email preferences are managed by Auto Mailer. Redirecting you there now.
          </p>
        </div>
        <a
          href={autoMailerUrl}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700"
        >
          <ExternalLink size={14} /> Open Auto Mailer
        </a>
        <p className="break-all text-[10px] text-[#64748b]">{autoMailerUrl}</p>
      </div>
    </div>
  );
}
