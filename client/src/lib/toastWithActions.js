import { pushCustomToast } from '../lib/notifications';

/**
 * Toast with action buttons (View / Undo / custom).
 */
export function toastWithActions(message, { actions = [], duration = 5000, id } = {}) {
  return pushCustomToast(
    (t) => (
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
        <span className="min-w-0 flex-1 truncate">{message}</span>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="shrink-0 rounded-md border border-[var(--color-bg-border)] px-2 py-1 text-[10px] font-black uppercase tracking-wide hover:bg-[var(--color-bg-secondary)]"
            onClick={() => {
              action.onClick?.();
              if (action.dismiss !== false) t.dismiss?.();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    ),
    { id, duration },
  );
}
