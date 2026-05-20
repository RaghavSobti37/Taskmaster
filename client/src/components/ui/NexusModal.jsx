import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from './index';

export const NexusModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info', // info, success, warning, danger
  onConfirm, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  isConfirm = false,
  showFooter = true,
  width = 'max-w-sm',
  children
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const typeConfig = {
    info: {
      icon: Info,
      color: 'var(--color-pastel-slate-text)',
      bg: 'var(--color-pastel-slate-bg)',
    },
    success: {
      icon: CheckCircle2,
      color: 'var(--color-pastel-mint-text)',
      bg: 'var(--color-pastel-mint-bg)',
    },
    warning: {
      icon: AlertTriangle,
      color: 'var(--color-pastel-apricot-text)',
      bg: 'var(--color-pastel-apricot-bg)',
    },
    danger: {
      icon: Trash2,
      color: 'var(--color-pastel-rose-text)',
      bg: 'var(--color-pastel-rose-bg)',
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`relative bg-[var(--color-bg-primary)] w-full ${width} rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-[var(--radius-atomic)]" style={{ background: config.bg, color: config.color }}>
                  <Icon size={14} />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider">{title}</h2>
              </div>
              <button type="button" onClick={onClose} className="p-1 hover:bg-black/5 rounded transition-colors">
                <X size={14} className="text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {message && (
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {message}
                </p>
              )}
              {children}
            </div>

            {/* Footer */}
            {showFooter && (
              <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-t border-[var(--color-bg-border)] flex items-center justify-end gap-2">
                {isConfirm ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={onClose}>
                      {cancelLabel}
                    </Button>
                    <Button 
                      size="sm" 
                      variant={type === 'danger' ? 'danger' : 'primary'} 
                      onClick={() => {
                        onConfirm();
                        onClose();
                      }}
                    >
                      {confirmLabel}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="primary" onClick={onClose}>
                    Acknowledged
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


