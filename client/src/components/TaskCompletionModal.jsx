import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Button } from './ui';

const TaskCompletionModal = ({ task, isOpen, onClose, onSubmit }) => {
  const [hours, setHours] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setHours(1);
  }, [isOpen]);

  if (!isOpen || !task) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl p-6 max-w-sm w-full relative overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-xl font-black tracking-tight text-[var(--color-text-primary)] mb-2">Complete Task</h2>
          <p className="text-sm font-bold text-[var(--color-text-secondary)] mb-6">{task.title}</p>
          
          <div className="mb-6 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-action-primary)]/30 ring-1 ring-[var(--color-action-primary)]/10">
             <label className="block text-[10px] font-black text-[var(--color-text-primary)] uppercase tracking-widest mb-2">Time Invested (Hours)</label>
             <Input 
               type="number" 
               min="0.5" 
               step="0.5" 
               value={hours}
               onChange={(e) => setHours(e.target.value)}
               className="w-full text-lg font-bold text-[var(--color-action-primary)]"
               autoFocus
             />
             <p className="text-[10px] text-[var(--color-text-muted)] mt-2 font-medium">This time will be logged to your daily logs.</p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button 
              onClick={async () => {
                setIsSubmitting(true);
                await onSubmit(task, Number(hours));
                setIsSubmitting(false);
              }} 
              disabled={isSubmitting} 
              className="flex-1"
            >
              {isSubmitting ? 'Saving...' : 'Mark Done'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskCompletionModal;
