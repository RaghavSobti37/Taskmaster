import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';

const ToastContext = createContext(null);

export const globalToast = {
  addToast: () => console.warn('globalToast called before ToastProvider initialized')
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(({ title, message, type = 'info', undoAction = null, duration = 6000 }) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast = { id, title, message, type, undoAction, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  // Expose to global object for non-component usage
  React.useEffect(() => {
    globalToast.addToast = addToast;
    window.alert = (msg) => {
      let isErr = false;
      if (typeof msg === 'string' && (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('required') || msg.toLowerCase().includes('mandatory'))) isErr = true;
      addToast({ title: isErr ? 'Action Failed' : 'System Message', message: String(msg), type: isErr ? 'error' : 'info' });
    };
  }, [addToast]);

  const handleUndo = useCallback(async (toast) => {
    if (!toast.undoAction) return;
    try {
      await toast.undoAction();
      removeToast(toast.id);
      addToast({ title: 'Undo successful', message: 'The action has been reversed.', type: 'success', duration: 3000 });
    } catch (err) {
      console.error('Undo execution failed:', err);
      addToast({ title: 'Undo failed', message: 'Could not reverse the action.', type: 'error', duration: 4000 });
    }
  }, [removeToast, addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-8 right-8 z-[99999] flex flex-col gap-3 pointer-events-none w-[90vw] max-w-[400px] sm:w-[400px]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                {toast.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/50" />}
                {toast.type === 'error' && <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-lg shadow-rose-500/50" />}
                {toast.type === 'info' && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-lg shadow-blue-500/50" />}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">{toast.title}</h4>
                  {toast.message && <p className="text-xs text-slate-300 mt-0.5">{toast.message}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toast.undoAction && (
                  <button
                    onClick={() => handleUndo(toast)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs transition-colors border border-emerald-500/30 active:scale-95"
                  >
                    <RotateCcw size={12} /> Undo
                  </button>
                )}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
