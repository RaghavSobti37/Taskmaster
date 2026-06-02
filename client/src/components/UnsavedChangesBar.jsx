import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui';

export default function UnsavedChangesBar({
  hasChanges,
  onCancel,
  onSave,
  isSaving,
  elevated = false,
}) {
  return (
    <AnimatePresence>
      {hasChanges && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] shadow-2xl rounded-xl p-4 flex items-center gap-6 min-w-[min(400px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] justify-between ${elevated ? 'z-[600]' : 'z-50'}`}
        >
          <div className="text-sm font-bold text-[var(--color-text-primary)] shrink-0">
            Careful — you have unsaved changes!
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
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
