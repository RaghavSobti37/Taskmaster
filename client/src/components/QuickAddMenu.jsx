import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useQuickAdd } from '../contexts/quickAddContextCore';
import QuickAddActionPanel from './QuickAddActionPanel';

/** Desktop floating add button — hidden on mobile (bottom nav slot handles add there). */
const QuickAddMenu = () => {
  const { open, toggleMenu, closeMenu } = useQuickAdd();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden lg:block fixed inset-0 z-[49]"
            aria-label="Close add menu"
            onClick={closeMenu}
          />
        )}
      </AnimatePresence>

      <div className="hidden lg:flex fixed bottom-6 right-6 z-50 flex-col items-end gap-2">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <QuickAddActionPanel />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={toggleMenu}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-12 h-12 bg-[var(--color-action-primary)] text-white rounded-full shadow-2xl shadow-teal-500/30 border border-white/20"
          title="Add"
          aria-label="Add"
          aria-expanded={open}
        >
          <Plus size={22} className={open ? 'rotate-45 transition-transform' : ''} />
        </motion.button>
      </div>
    </>
  );
};

export default QuickAddMenu;
