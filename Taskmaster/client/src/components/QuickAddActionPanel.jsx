import React from 'react';
import { useQuickAdd } from '../contexts/quickAddContextCore';

export default function QuickAddActionPanel({ className = '', align = 'end' }) {
  const { actions } = useQuickAdd();
  const alignClass = align === 'center' ? 'items-center' : 'items-end';

  return (
    <div className={`tm-floating flex flex-col gap-1.5 p-2 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] shadow-xl ${alignClass} ${className}`}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-[var(--radius-atomic)] text-xs font-bold hover:bg-[var(--color-bg-secondary)] whitespace-nowrap w-full text-left"
        >
          <action.icon size={14} />
          {action.label}
        </button>
      ))}
    </div>
  );
}
