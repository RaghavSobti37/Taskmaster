import React from 'react';
import { motion } from 'framer-motion';

/**
 * PageHeader — Standardized page header for consistent design language.
 *
 * @param {React.ElementType} icon - Lucide icon component
 * @param {string} title           - Page title (rendered uppercase, font-black)
 * @param {string} subtitle        - Page subtitle
 * @param {React.ReactNode} actions - Right-side action buttons
 * @param {React.ReactNode} children - Additional header content (below title)
 */
const PageHeader = ({ icon: Icon, title, subtitle, actions, children }) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="p-2.5 bg-[var(--color-action-primary)]/10 rounded-xl text-[var(--color-action-primary)] shadow-sm border border-[var(--color-action-primary)]/10">
              <Icon size={20} strokeWidth={2.5} />
            </div>
          )}
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase leading-tight">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className={`text-[10px] md:text-xs font-medium text-[var(--color-text-muted)] ${Icon ? 'ml-12 md:ml-14' : ''}`}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-center">
          {actions}
        </div>
      )}
    </motion.header>
  );
};

export default PageHeader;
