import React from 'react';

/**
 * Flat list row — border-b divider, optional left accent bar.
 */
export default function DataListRow({
  onClick,
  accentColor,
  className = '',
  leading,
  primary,
  secondary,
  trailing,
  as: Component = onClick ? 'button' : 'div',
}) {
  const style = accentColor ? { borderLeftColor: accentColor, borderLeftWidth: '3px', borderLeftStyle: 'solid' } : undefined;

  return (
    <Component
      type={Component === 'button' ? 'button' : undefined}
      onClick={onClick}
      style={style}
      className={`w-full text-left tm-data-row flex items-center gap-2.5 min-w-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        {primary}
        {secondary && <div className="mt-0.5">{secondary}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Component>
  );
}
