import React from 'react';
import { Webhook, Zap } from 'lucide-react';

/** Brand marks for Connected Apps — inline SVG, no external CDN (CSP-safe). */
const BRAND_SVGS = {
  gmail: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path fill="#EA4335" d="M5 5h14v14H5z" />
      <path fill="#FBBC05" d="M5 5l7 7 7-7H5z" />
      <path fill="#34A853" d="M5 19l7-7 7 7H5z" />
      <path fill="#4285F4" d="M12 12L5 5v14l7-7zm7-7v14l-7-7 7-7z" />
      <path fill="#fff" d="M12 12 5 5h3.5L12 9.5 15.5 5H19l-7 7z" opacity=".9" />
    </svg>
  ),
  resend: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#0A0A0A" />
      <path fill="#fff" d="M7 8h10v1.8H9.4v2.2H16v1.8H9.4V16H7V8z" />
    </svg>
  ),
  brevo: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#0B996E" />
      <path fill="#fff" d="M8 7h3.2c2.2 0 3.8 1.4 3.8 3.4S13.4 14 11.2 14H10v3H8V7zm2 5h1.1c1.1 0 1.8-.6 1.8-1.6S12.2 9 11.1 9H10v3z" />
    </svg>
  ),
  mailchimp: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#FFE01B" />
      <path fill="#241C15" d="M12 6.5c-2.4 0-4.2 1.6-4.8 3.8-.6-.3-1.3-.2-1.8.3-.7.7-.6 1.9.2 2.5.4 2.6 2.5 4.6 5.1 4.9.1.6.6 1 1.2 1 .7 0 1.2-.5 1.3-1.2 2.1-.5 3.7-2.3 4-4.5.8-.5 1-1.5.4-2.2-.4-.5-1-.7-1.6-.6-.7-2-2.5-3.4-4.9-3.4z" />
    </svg>
  ),
  hubspot: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <circle cx="12" cy="12" r="10" fill="#FF7A59" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" />
      <circle cx="17.2" cy="8.2" r="2" fill="#fff" />
      <path stroke="#fff" strokeWidth="1.6" d="M14.2 10.4l2.2-1.8M12 8.8V5.5" />
    </svg>
  ),
  google_sheets: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="4" fill="#0F9D58" />
      <path fill="#fff" d="M7 6h7l3 3v9H7V6zm7 0v3h3l-3-3z" opacity=".95" />
      <path stroke="#0F9D58" strokeWidth=".8" d="M9 11h6M9 13.5h6M9 16h4" />
    </svg>
  ),
  aisensy: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path fill="#fff" d="M12 5.5c-3.6 0-6.5 2.7-6.5 6 0 1.1.3 2.1.8 3L5 18.5l3.8-1.1c.9.5 1.9.8 3.2.8 3.6 0 6.5-2.7 6.5-6s-2.9-6-6.5-6zm0 10.5c-.9 0-1.8-.2-2.5-.6l-.2-.1-2 .6.6-1.9-.1-.2c-.5-.7-.8-1.6-.8-2.5 0-2.5 2.2-4.5 5-4.5s5 2 5 4.5-2.2 4.5-5 4.5z" />
    </svg>
  ),
  salesforce: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#00A1E0" />
      <path fill="#fff" d="M8.2 14.5c-.9 0-1.6-.7-1.6-1.6 0-.6.3-1.1.8-1.4-.2-2 1.4-3.7 3.4-3.7 1 0 1.9.4 2.5 1.1.5-.3 1.1-.5 1.7-.5 2.3 0 4.1 1.9 4.1 4.2 0 .2 0 .4-.1.6.5.3.8.9.8 1.5 0 1-.8 1.8-1.8 1.8H8.2z" />
    </svg>
  ),
  slack: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#4A154B" />
      <path fill="#E01E5A" d="M10.5 5.5a1.5 1.5 0 0 1 3 0v4.5H12a1.5 1.5 0 0 1-1.5-1.5V5.5z" />
      <path fill="#36C5F0" d="M5.5 13.5a1.5 1.5 0 0 1 0-3H10v1.5a1.5 1.5 0 0 1-1.5 1.5H5.5z" />
      <path fill="#2EB67D" d="M13.5 18.5a1.5 1.5 0 0 1-3 0V14H12a1.5 1.5 0 0 1 1.5 1.5v3z" />
      <path fill="#ECB22E" d="M18.5 10.5a1.5 1.5 0 0 1 0 3H14v-1.5a1.5 1.5 0 0 1 1.5-1.5h3z" />
    </svg>
  ),
  zapier: (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <rect width="24" height="24" rx="6" fill="#FF4A00" />
      <path fill="#fff" d="M8 8h8l-4 4 4 4H8l4-4-4-4z" />
    </svg>
  ),
};

const FALLBACK_ICONS = {
  webhook: Webhook,
  zap: Zap,
};

const TILE_BG = {
  gmail: 'bg-white',
  resend: 'bg-neutral-900',
  brevo: 'bg-emerald-600',
  mailchimp: 'bg-[#FFE01B]',
  hubspot: 'bg-[#FF7A59]',
  google_sheets: 'bg-[#0F9D58]',
  aisensy: 'bg-[#25D366]',
  salesforce: 'bg-[#00A1E0]',
  slack: 'bg-[#4A154B]',
  webhook_in: 'bg-violet-600/20 border border-violet-500/30',
  zapier: 'bg-[#FF4A00]',
};

export default function IntegrationProviderLogo({ providerId, name, size = 'md', className = '' }) {
  const id = providerId || '';
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const tileBg = TILE_BG[id] || 'bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]';

  if (id === 'webhook_in') {
    const Icon = FALLBACK_ICONS.webhook;
    return (
      <div
        className={`${dim} shrink-0 rounded-xl flex items-center justify-center text-violet-400 ${tileBg} ${className}`}
        title={name}
        aria-hidden
      >
        <Icon size={20} strokeWidth={2} />
      </div>
    );
  }

  const svg = BRAND_SVGS[id];
  if (!svg) {
    const Icon = FALLBACK_ICONS.zap;
    return (
      <div
        className={`${dim} shrink-0 rounded-xl flex items-center justify-center bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] ${className}`}
        title={name}
        aria-hidden
      >
        <Icon size={20} />
      </div>
    );
  }

  return (
    <div
      className={`${dim} shrink-0 rounded-xl flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 ${tileBg} ${className}`}
      title={name}
      aria-hidden
    >
      {svg}
    </div>
  );
}
