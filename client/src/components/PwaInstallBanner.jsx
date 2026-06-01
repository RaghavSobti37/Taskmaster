import React from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const PwaInstallBanner = () => {
  const { canInstall, promptInstall, dismiss } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-lg lg:left-auto lg:right-6 lg:mx-0">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-4 shadow-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
          <Download size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-primary)]">
            Install Coreknot
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Add to your desktop for alerts even when the browser tab is closed.
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
