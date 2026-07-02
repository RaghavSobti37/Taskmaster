import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTransitionSurface } from '../../hooks/transitions';
import { shouldSubmitModalOnEnter, triggerModalPrimarySubmit } from '../../lib/modalEnter';

/** Pixel widths for centered modals — inline styles prevent flex collapse */
export const MODAL_WIDTH_PX = {
  sm: 448,
  md: 512,
  lg: 672,
  xl: 896,
  '2xl': 1024,
  full: 1200,
  /** Task detail — fullscreen layout with optional width cap via panelClassName */
  task: 1400,
  fullscreen: null,
};

const CENTERED_SIZE_TOKENS = new Set(['sm', 'md', 'lg', 'xl', '2xl', 'full']);

export const isFullscreenSize = (size) => size === 'fullscreen' || size === 'task';

const normalizeCenteredSize = (size) => (CENTERED_SIZE_TOKENS.has(size) ? size : 'md');

export const MODAL_PANEL_CLASS = 'tm-modal-panel';
export const MODAL_OVERLAY_CLASS = 'tm-modal-overlay';

const getModalPanelClassName = (size = 'fullscreen', extra = '') => {
  if (isFullscreenSize(size)) {
    return [MODAL_PANEL_CLASS, 'tm-modal-fullscreen', extra].filter(Boolean).join(' ');
  }
  const token = normalizeCenteredSize(size);
  return [MODAL_PANEL_CLASS, `tm-modal-${token}`, 'tm-modal-compact', extra].filter(Boolean).join(' ');
};

export const getModalPanelStyle = (sizeOrPx = 'fullscreen', widthPx) => {
  if (widthPx != null) {
    return {
      ['--tm-modal-width']: `${widthPx}px`,
      width: `min(calc(100vw - 2rem), ${widthPx}px)`,
      minWidth: 'min(320px, calc(100vw - 2rem))',
      maxWidth: 'calc(100vw - 2rem)',
      flexShrink: 0,
      flexGrow: 0,
      boxSizing: 'border-box',
    };
  }
  if (isFullscreenSize(sizeOrPx)) {
    return {
      boxSizing: 'border-box',
      flexShrink: 0,
      flexGrow: 0,
    };
  }
  const token = normalizeCenteredSize(sizeOrPx);
  const px = MODAL_WIDTH_PX[token] ?? MODAL_WIDTH_PX.md;
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

const ModalTitleIdContext = React.createContext(null);
const ModalLayoutContext = React.createContext({ fullscreen: true });

/**
 * Shared modal overlay + panel shell.
 * Uses grid centering + explicit width (not flex shrink) to prevent collapsed modals.
 */
export const ModalShell = ({
  isOpen,
  onClose,
  children,
  size = 'fullscreen',
  widthPx,
  zIndex = 1000,
  className = '',
  panelClassName = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  submitOnEnter = true,
  ariaLabel,
}) => {
  const fullscreen = isFullscreenSize(size);
  const centered = !fullscreen;
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
      if (e.key !== 'Escape' || !closeOnEscape) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose?.();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey, true);
    };
  }, [mounted, onClose, closeOnEscape]);

  const handlePanelKeyDown = React.useCallback((e) => {
    if (!submitOnEnter || e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
    if (!shouldSubmitModalOnEnter(e.target)) return;
    if (triggerModalPrimarySubmit(panelRef.current)) {
      e.preventDefault();
    }
  }, [submitOnEnter]);

  if (typeof document === 'undefined') return null;

  const panelStyle = getModalPanelStyle(size, widthPx);
  const handleBackdropClick = closeOnBackdrop ? onClose : undefined;
  const overlayPadding = centered
    ? 'px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6'
    : 'p-0';
  const panelLayout = centered
    ? 'h-auto rounded-[var(--radius-lg)] max-h-[min(85vh,900px)] shadow-2xl'
    : 'rounded-none h-[100dvh] max-h-[100dvh] shadow-none border-x-0 border-t-0';

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
      <div className={`absolute inset-0 ${MODAL_OVERLAY_CLASS} ${fullscreen ? 'tm-modal-overlay--fullscreen' : 'tm-modal-overlay--centered'} ${overlayPadding} pointer-events-none overflow-y-auto`}>
        <div
          ref={panelRef}
          style={panelStyle}
          className={`t-modal ${getModalPanelClassName(size)} tm-floating pointer-events-auto relative bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] flex flex-col overflow-hidden w-full ${panelLayout} ${surfaceClass} ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handlePanelKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
        >
          <ModalLayoutContext.Provider value={{ fullscreen }}>
            <ModalTitleIdContext.Provider value={titleId}>
              {children}
            </ModalTitleIdContext.Provider>
          </ModalLayoutContext.Provider>
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
  <div className="tm-modal-header flex items-center justify-between px-6 py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] shrink-0 sticky top-0 z-10">
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
      <button type="button" onClick={onClose} aria-label="Close dialog" className="inline-flex items-center justify-center min-h-11 min-w-11 p-2 hover:bg-black/5 rounded transition-colors shrink-0 touch-manipulation">
        <X size={16} className="text-[var(--color-text-muted)]" />
      </button>
    )}
  </div>
  );
};

export const ModalBody = ({ children, className = '', scrollable }) => {
  const { fullscreen } = React.useContext(ModalLayoutContext);
  const grow = scrollable ?? fullscreen;
  return (
    <div
      className={`tm-modal-scroll p-6 space-y-4 ${grow ? 'flex-1 min-h-0' : 'tm-modal-scroll--content'} ${className}`}
    >
      {children}
    </div>
  );
};

export const ModalFooter = ({ children, className = '' }) => (
  <div
    className={`tm-modal-footer px-6 py-4 bg-[var(--color-bg-secondary)] border-t border-[var(--color-bg-border)] flex items-center justify-end gap-2 shrink-0 ${className}`}
  >
    {children}
  </div>
);
