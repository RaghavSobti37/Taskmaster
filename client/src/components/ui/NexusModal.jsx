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
  children
}) => {
  const typeConfig = {
    info: {
      icon: Info,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    success: {
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20'
    },
    danger: {
      icon: Trash2,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 isolate">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative bg-[var(--color-bg-surface)] w-full max-w-md rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden p-8 dark:shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className={`p-5 rounded-[1.5rem] ${config.bg} ${config.color} border ${config.border} shadow-inner`}>
                <Icon size={36} strokeWidth={2.5} />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">
                  {title}
                </h2>
                <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-relaxed px-4">
                  {message}
                </p>
              </div>

              {children}

              <div className="flex items-center gap-3 w-full pt-4">
                {isConfirm ? (
                  <>
                    <Button 
                      variant="secondary" 
                      onClick={onClose} 
                      className="flex-1 py-4 bg-[var(--color-bg-workspace)] border-[var(--color-bg-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-border)]"
                    >
                      {cancelLabel}
                    </Button>
                    <Button 
                      variant={type === 'danger' ? 'danger' : 'primary'} 
                      onClick={() => {
                        onConfirm();
                        onClose();
                      }} 
                      className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] shadow-xl ${type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : 'bg-[var(--color-action-primary)] hover:bg-[var(--color-action-hover)] shadow-blue-500/20'}`}
                    >
                      {confirmLabel}
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="primary" 
                    onClick={onClose} 
                    className="w-full py-4 font-black uppercase tracking-widest text-[10px] shadow-xl bg-[var(--color-action-primary)] hover:bg-[var(--color-action-hover)]"
                  >
                    Acknowledged
                  </Button>
                )}
              </div>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] rounded-xl transition-all group"
            >
              <X size={20} className="group-hover:rotate-90 transition-transform" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
