import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MODAL_PANEL_CLASS, MODAL_OVERLAY_CLASS, getModalPanelStyle } from './ModalShell';

/**
 * Centered modal overlay for bespoke dialogs.
 * Uses grid + explicit pixel width (same fix as ModalShell) — never flex-shrink collapse.
 */
export const CenteredModal = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  widthPx,
  zIndex = 1000,
  className = '',
  panelClassName = '',
}) => {
  React.useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey, true);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const panelStyle = getModalPanelStyle(widthPx ?? size);
  const resolvedPx = typeof (widthPx ?? size) === 'number'
    ? widthPx ?? size
    : { sm: 448, md: 512, lg: 672, xl: 896, '2xl': 1024, full: 1200 }[widthPx ?? size] || 512;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 ${className}`} style={{ zIndex }} role="presentation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <div className={`absolute inset-0 ${MODAL_OVERLAY_CLASS} p-4 sm:p-6 pointer-events-none overflow-y-auto`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                ...panelStyle,
                width: `min(calc(100vw - 2rem), ${resolvedPx}px)`,
              }}
              className={`${MODAL_PANEL_CLASS} pointer-events-auto relative bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] shadow-2xl flex flex-col max-h-[min(85vh,900px)] overflow-hidden ${panelClassName}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
