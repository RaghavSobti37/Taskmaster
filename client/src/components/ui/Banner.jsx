import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

const VARIANTS = {
  info: {
    bar: 'bg-[var(--color-action-primary)]',
    border: 'border-[var(--color-action-primary)]/25',
    bg: 'bg-[var(--color-action-primary)]/8',
    text: 'text-[var(--color-text-primary)]',
    Icon: Info,
    iconClass: 'text-[var(--color-action-primary)]',
  },
  advisory: {
    bar: 'bg-amber-500',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-900 dark:text-amber-200',
    Icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-300',
  },
  error: {
    bar: 'bg-red-500',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-300',
    Icon: AlertCircle,
    iconClass: 'text-red-600 dark:text-red-400',
  },
};

/**
 * Banner — severity-colored alert with 3px accent bar (info/teal, advisory/amber, error/red).
 */
export default function Banner({
  variant = 'advisory',
  message,
  children,
  actions,
  className = '',
  role,
}) {
  const v = VARIANTS[variant] || VARIANTS.advisory;
  const { Icon } = v;
  const content = children ?? message;

  return (
    <div
      className={`list-page-banner relative flex flex-wrap items-center justify-between gap-3 rounded-[10px] border pl-4 pr-4 py-3 ${v.border} ${v.bg} ${className}`}
      role={role || (variant === 'error' ? 'alert' : 'status')}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px] ${v.bar}`} aria-hidden />
      <div className={`flex items-start gap-2 text-sm min-w-0 flex-1 ${v.text}`}>
        <Icon size={18} className={`shrink-0 mt-0.5 ${v.iconClass}`} aria-hidden />
        <div className="min-w-0">{content}</div>
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
