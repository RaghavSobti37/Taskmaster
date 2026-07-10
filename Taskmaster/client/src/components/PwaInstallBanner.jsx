import React from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useIsMobile } from '../hooks/useBreakpoint';

const PwaInstallBanner = () => {
  const { canInstall, promptInstall, dismiss } = usePwaInstall();
  const isMobile = useIsMobile();

  if (!canInstall) return null;

  return (
    <div
      className={`fixed z-[90] mx-auto max-w-lg ${
        isMobile
          ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4'
          : 'bottom-4 left-4 right-4 lg:left-auto lg:right-6 lg:mx-0'
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-4 shadow-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
          {isMobile ? <Smartphone size={18} /> : <Download size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-primary)]">
            {isMobile ? 'Install CoreKnot app' : 'Install CoreKnot'}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {isMobile
              ? 'Add to your home screen for quick access and push alerts.'
              : 'Add to your desktop for alerts even when the browser tab is closed.'}
          </p>
        </div>
        <button
          type="button"
          onClick={promptInstall}
          className="shrink-0 rounded-lg bg-[var(--color-action-primary)] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Dismiss install banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
