import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ExternalLink, Monitor, Smartphone } from 'lucide-react';
import BrandLogo from '../brand/BrandLogo';
import { Button } from '../ui/primitives';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://tsccoreknot.com';

export default function DesktopRequiredScreen({
  title = 'Desktop experience',
  description,
  alternatives = [],
  currentPath,
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const shareUrl = `${APP_URL}${currentPath || ''}`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link to open on desktop:', shareUrl);
    }
  }, [shareUrl]);

  return (
    <div
      className="mobile-desktop-gate flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] px-4 py-8 -mx-4 lg:mx-0"
      data-mobile-desktop-gate
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-3xl bg-[var(--color-action-primary)]/15 blur-2xl scale-150" aria-hidden />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] shadow-lg">
              <BrandLogo size={44} />
            </div>
            <div
              className="absolute -bottom-2 -right-2 flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400"
              aria-hidden
            >
              <Monitor size={18} strokeWidth={2.5} />
            </div>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-action-primary)] mb-2">
            Desktop recommended
          </p>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{title}</h1>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-sm">
            {description ||
              'This section is built for keyboard and large screens. Continue on your computer for the full experience.'}
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <div className="rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
              Open on desktop
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <Monitor size={16} className="shrink-0 text-[var(--color-text-muted)]" />
              <span className="flex-1 min-w-0 text-xs font-mono text-[var(--color-text-secondary)] truncate">
                {shareUrl}
              </span>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[var(--color-action-primary)] text-white"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              Sign in with the same account on a laptop or desktop browser, or paste this link into Chrome, Safari, or Edge on your computer.
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <Smartphone size={16} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-[var(--color-text-primary)]">CoreKnot mobile app</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                Dashboard, tasks, inbox, attendance, and CRM are fully optimized here. Use this device for day-to-day work.
              </p>
            </div>
          </div>
        </div>

        {alternatives.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-3 text-center">
              Continue on mobile
            </p>
            <div className="grid grid-cols-2 gap-2">
              {alternatives.map((alt) => (
                <button
                  key={alt.path}
                  type="button"
                  onClick={() => navigate(alt.path)}
                  className="px-4 py-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-xs font-bold text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)]/40 hover:bg-[var(--token-surface-2)] transition-colors text-left"
                >
                  {alt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center gap-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            Go back
          </Button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] transition-colors"
          >
            <ExternalLink size={14} />
            Open link in browser
          </a>
        </div>
      </div>
    </div>
  );
}
