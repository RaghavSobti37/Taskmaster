import React from 'react';

/**
 * Shared skeleton for tabbed module hubs (CRM, Management, Office).
 * Header row (title + intrinsic-width subnav) above scrollable panel content.
 */
export default function HubPageLayout({ header, children, className = '' }) {
  return (
    <div className={`flex flex-col min-h-0 lg:h-full hub-page-stack ${className}`.trim()}>
      <div className="tm-hub-header shrink-0 min-w-0">{header}</div>
      {children}
    </div>
  );
}
