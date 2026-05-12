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
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20'
    },
    danger: {
      icon: Trash2,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20'
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-[var(--color-bg-surface)] w-full max-w-md rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden p-8"
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className={`p-4 rounded-2xl ${config.bg} ${config.color} border ${config.border}`}>
                <Icon size={32} />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight">
                  {title}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {message}
                </p>
              </div>

              {children}

              <div className="flex items-center gap-3 w-full">
                {isConfirm ? (
                  <>
                    <Button 
                      variant="secondary" 
                      onClick={onClose} 
                      className="flex-1 py-3"
                    >
                      {cancelLabel}
                    </Button>
                    <Button 
                      variant={type === 'danger' ? 'danger' : 'primary'} 
                      onClick={() => {
                        onConfirm();
                        onClose();
                      }} 
                      className="flex-1 py-3"
                    >
                      {confirmLabel}
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="primary" 
                    onClick={onClose} 
                    className="w-full py-3"
                  >
                    Acknowledged
                  </Button>
                )}
              </div>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-workspace)] rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
