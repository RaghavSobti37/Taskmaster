import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { PAGE_GROUPS } from '../../utils/pagePermissions';

const PagePermissionsEditor = ({ selectedPages, onChange }) => {
  const togglePage = (key) => {
    onChange(
      selectedPages.includes(key)
        ? selectedPages.filter((k) => k !== key)
        : [...selectedPages, key]
    );
  };

  const toggleGroup = (group) => {
    const keys = group.pages.map((p) => p.key);
    const allOn = keys.every((k) => selectedPages.includes(k));
    if (allOn) {
      onChange(selectedPages.filter((k) => !keys.includes(k)));
    } else {
      onChange([...new Set([...selectedPages, ...keys])]);
    }
  };

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
      {PAGE_GROUPS.map((group) => {
        const keys = group.pages.map((p) => p.key);
        const enabledCount = keys.filter((k) => selectedPages.includes(k)).length;
        const allOn = enabledCount === keys.length;

        return (
          <div key={group.id} className="border border-[var(--color-bg-border)] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-border)]/40 transition-colors"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                {group.label}
              </span>
              <span className="text-[9px] font-bold text-[var(--color-text-muted)]">
                {enabledCount}/{keys.length}
              </span>
            </button>
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {group.pages.map((page) => {
                const checked = selectedPages.includes(page.key);
                return (
                  <label
                    key={page.key}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[11px] transition-colors ${
                      checked
                        ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-text-primary)]'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => togglePage(page.key)}
                    />
                    {checked ? <CheckSquare size={14} className="shrink-0 text-[var(--color-action-primary)]" /> : <Square size={14} className="shrink-0 opacity-40" />}
                    <span className="truncate">{page.label}</span>
                  </label>
                );
              })}
            </div>
            {!allOn && enabledCount > 0 && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => onChange([...new Set([...selectedPages, ...keys])])}
                  className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
                >
                  Enable all in {group.label}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PagePermissionsEditor;
