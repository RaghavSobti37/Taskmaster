import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Render-style integration link row — left accent, icon chip, subtitle.
 */
export default function IntegrationLinkRow({ label, subtitle, icon: Icon, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group w-full text-left rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)]',
        'bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)]',
        'border-l-[3px] transition-colors',
        tone.accent,
      ].join(' ')}
    >
      <span className="flex items-center gap-3 p-2.5 min-h-[44px]">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}
          aria-hidden
        >
          <Icon size={15} strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-action-primary)] transition-colors">
            {label}
          </span>
          {subtitle ? (
            <span className="block text-[10px] text-[var(--color-text-muted)] font-mono truncate mt-0.5">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ExternalLink
          size={14}
          className="shrink-0 text-[var(--color-text-muted)] opacity-50 group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      </span>
    </button>
  );
}

export const INTEGRATION_TONES = {
  production: {
    label: 'Production',
    badge: 'badge-mint',
    accent: 'border-l-[var(--color-pastel-mint-text)]',
    chip: 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]',
  },
  staging: {
    label: 'Staging',
    badge: 'badge-apricot',
    accent: 'border-l-[var(--color-pastel-apricot-text)]',
    chip: 'bg-[var(--color-pastel-apricot-bg)] text-[var(--color-pastel-apricot-text)]',
  },
  platform: {
    label: 'Platform',
    badge: 'badge-sky',
    accent: 'border-l-[var(--color-pastel-blue-text)]',
    chip: 'bg-[var(--color-pastel-blue-bg)] text-[var(--color-pastel-blue-text)]',
  },
};

export function IntegrationLinkGroup({ title, children }) {
  if (!children) return null;
  return (
    <div className="space-y-1.5">
      <p className="tm-section-label px-0.5">{title}</p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}
