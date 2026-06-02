import React, { useState } from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * Mobile-only page header for detail/nested routes.
 */
export default function MobilePageHeader({
  title,
  subtitle,
  onBack,
  backTo,
  primaryAction,
  menuItems = [],
  className = '',
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isMobile) return null;

  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
    else navigate(-1);
  };

  return (
    <div className={`lg:hidden flex items-center gap-2 min-h-[44px] mb-3 ${className}`}>
      <button
        type="button"
        onClick={handleBack}
        className="p-2 -ml-2 rounded-lg hover:bg-[var(--color-bg-secondary)] min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
        aria-label="Go back"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)] truncate">{title}</h1>
        {subtitle && (
          <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      {menuItems.length > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="More actions"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-xl">
                {menuItems.map((item, i) => (
                  <button
                    key={item.id || i}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick?.();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
