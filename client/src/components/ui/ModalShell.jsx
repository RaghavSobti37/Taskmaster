import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTransitionSurface } from '../../hooks/transitions';

/** Pixel widths — inline styles so modals never collapse when Tailwind max-w isn't applied */
export const MODAL_WIDTH_PX = {
  sm: 448,
  md: 512,
  lg: 672,
  xl: 896,
  '2xl': 1024,
  full: 1200,
  /** Task detail — near full-screen width */
  task: 1400,
};

export const MODAL_PANEL_CLASS = 'tm-modal-panel';
export const MODAL_OVERLAY_CLASS = 'tm-modal-overlay';

const getModalPanelClassName = (size = 'lg', extra = '') => {
  const sizeClass = typeof size === 'number' ? '' : `tm-modal-${size}`;
  return [MODAL_PANEL_CLASS, sizeClass, extra].filter(Boolean).join(' ');
};

export const getModalPanelStyle = (sizeOrPx = 'lg') => {
  const px = typeof sizeOrPx === 'number' ? sizeOrPx : (MODAL_WIDTH_PX[sizeOrPx] || MODAL_WIDTH_PX.lg);
  return {
    ['--tm-modal-width']: `${px}px`,
    width: `min(calc(100vw - 2rem), ${px}px)`,
    minWidth: 'min(320px, calc(100vw - 2rem))',
    maxWidth: 'calc(100vw - 2rem)',
    flexShrink: 0,
    flexGrow: 0,
    boxSizing: 'border-box',
  };
};

/** Composable modal shell — prefer NexusModal first; use ModalShell directly when layout is custom */
const ModalOverlay = ({
  children,
  className = '',
  zIndex = 1000,
  onBackdropClick,
  padding = true,
}) => (
  <div
    className={`${MODAL_OVERLAY_CLASS} fixed inset-0 ${padding ? 'p-4 sm:p-6' : ''} ${className}`}
    style={{ zIndex }}
    onClick={onBackdropClick}
    role="presentation"
  >
    {children}
  </div>
);

const ModalTitleIdContext = React.createContext(null);

/**
 * Shared modal overlay + panel shell.
 * Uses grid centering + explicit width (not flex shrink) to prevent collapsed modals.
 */
export const ModalShell = ({
  isOpen,
  onClose,
  children,
  size = 'lg',
  widthPx,
  zIndex = 1000,
  className = '',
  panelClassName = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
}) => {
  const panelRef = React.useRef(null);
  const titleId = React.useId();
  const { mounted, surfaceClass } = useTransitionSurface(isOpen, {
    closeVar: '--modal-close-dur',
    closeFallback: 150,
  });
  useFocusTrap(mounted, panelRef);

  React.useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && closeOnEscape) onClose?.();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey, true);
    };
  }, [mounted, onClose, closeOnEscape]);

  if (typeof document === 'undefined') return null;

  const panelStyle = getModalPanelStyle(widthPx ?? size);
  const handleBackdropClick = closeOnBackdrop ? onClose : undefined;

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${className}`}
      style={{ zIndex }}
      role="presentation"
    >
      <div
        className={`tm-modal-backdrop t-modal-backdrop absolute inset-0 bg-black/40 ${surfaceClass}`}
        onClick={handleBackdropClick}
      />
      <div className={`absolute inset-0 ${MODAL_OVERLAY_CLASS} p-4 sm:p-6 pointer-events-none overflow-y-auto`}>
        <div
          ref={panelRef}
          style={{
            ...panelStyle,
            width: `min(calc(100vw - 2rem), ${typeof (widthPx ?? size) === 'number' ? widthPx ?? size : MODAL_WIDTH_PX[widthPx ?? size] || MODAL_WIDTH_PX.lg}px)`,
          }}
          className={`t-modal ${MODAL_PANEL_CLASS} tm-floating pointer-events-auto relative bg-[var(--color-bg-primary)] rounded-[var(--radius-lg)] border border-[var(--color-bg-border)] shadow-2xl flex flex-col max-h-[min(85vh,900px)] overflow-hidden w-full ${surfaceClass} ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
        >
          <ModalTitleIdContext.Provider value={titleId}>
            {children}
          </ModalTitleIdContext.Provider>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ModalHeader = ({
  title,
  subtitle,
  onClose,
  icon: Icon,
  iconStyle,
  showClose = true,
  subtitleFirst = false,
  prominentTitle = false,
  titleId: titleIdProp,
}) => {
  const contextTitleId = React.useContext(ModalTitleIdContext);
  const titleId = titleIdProp || contextTitleId;
  return (
  <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] shrink-0">
    <div className="flex items-center gap-2 min-w-0">
      {Icon && (
        <div className="p-1.5 rounded-[var(--radius-atomic)] shrink-0" style={iconStyle}>
          <Icon size={16} />
        </div>
      )}
      <div className="min-w-0 flex flex-col gap-0.5">
        {subtitle && subtitleFirst && (
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] truncate">{subtitle}</p>
        )}
        <h2
          id={titleId || undefined}
          className={
            prominentTitle
              ? 'text-xl font-black leading-tight normal-case tracking-normal truncate'
              : 'text-sm font-bold uppercase tracking-wider truncate'
          }
        >
          {title}
        </h2>
        {subtitle && !subtitleFirst && (
          <p className="text-[11px] text-[var(--color-text-muted)] font-normal normal-case tracking-normal mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
    {showClose && onClose && (
      <button type="button" onClick={onClose} aria-label="Close dialog" className="p-1.5 hover:bg-black/5 rounded transition-colors shrink-0">
        <X size={16} className="text-[var(--color-text-muted)]" />
      </button>
    )}
  </div>
  );
};

export const ModalBody = ({ children, className = '' }) => (
  <div className={`tm-modal-scroll p-6 space-y-4 flex-1 min-h-0 ${className}`}>{children}</div>
);

export const ModalFooter = ({ children, className = '' }) => (
  <div
    className={`tm-modal-footer px-6 py-4 bg-[var(--color-bg-secondary)] border-t border-[var(--color-bg-border)] flex items-center justify-end gap-2 shrink-0 ${className}`}
  >
    {children}
  </div>
);
