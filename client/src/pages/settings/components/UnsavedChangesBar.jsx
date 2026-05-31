import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '../../../components/ui';

export default function UnsavedChangesBar({ hasChanges, onReset, onSave, isSaving }) {
  return (
    <AnimatePresence>
      {hasChanges && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] shadow-2xl rounded-xl p-4 flex items-center gap-6 min-w-[400px] justify-between"
          style={{ width: 'auto' }}
        >
          <div className="text-sm font-bold text-[var(--color-text-primary)]">
            Careful — you have unsaved changes!
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={isSaving}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
