import React from 'react';

const TONE_CLASS = {
  mint: 'text-[var(--color-pastel-mint-text)]',
  rose: 'text-[var(--color-pastel-rose-text)]',
  muted: 'text-[var(--color-text-muted)]',
  default: 'text-[var(--color-text-primary)]',
};

export default function MetricBlock({
  label,
  value,
  sub,
  tone = 'default',
  title,
  size = 'md',
  className = '',
  onClick,
  as: Component = onClick ? 'button' : 'div',
}) {
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.default;
  const valueSize = size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'min-w-0 text-left',
        onClick ? 'rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors -m-1 p-1' : '',
        className,
      ].join(' ')}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`${valueSize} font-black font-mono tabular-nums leading-tight mt-0.5 ${toneClass}`}
        title={title}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] mt-0.5">{sub}</p>
      )}
    </Component>
  );
}
