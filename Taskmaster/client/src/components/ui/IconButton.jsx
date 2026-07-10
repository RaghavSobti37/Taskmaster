import React from 'react';

const variants = {
  default: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
  primary: 'bg-[var(--color-action-primary)] text-[var(--color-bg-primary)] hover:opacity-90',
  danger: 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border border-[var(--color-pastel-rose-text)]/10 hover:bg-[var(--color-pastel-rose-text)]/10',
};

const sizes = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

/**
 * IconButton — square icon-only control for toolbars, modals, table rows.
 */
const IconButton = ({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  >
    {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} strokeWidth={2.25} />}
  </button>
);

export default IconButton;
