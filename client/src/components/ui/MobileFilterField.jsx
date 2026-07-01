import React, { isValidElement, cloneElement } from 'react';

function stripFixedWidths(className = '') {
  return className
    .replace(/\s*!?w-\[[^\]]+\]/g, '')
    .replace(/\s*!?w-\d+/g, '')
    .replace(/\s*!?min-w-\[[^\]]+\]/g, '')
    .replace(/\s*!?min-w-\d+/g, '')
    .replace(/\s*!?max-w-\[[^\]]+\]/g, '')
    .replace(/\s*!?max-w-\d+/g, '')
    .replace(/\s*shrink-0/g, '')
    .replace(/\s*shrink(?=\s|$)/g, '')
    .trim();
}

function resolveFieldLabel(child) {
  if (!isValidElement(child)) return null;
  const { placeholder, 'data-filter-label': dataLabel } = child.props || {};
  return dataLabel || placeholder || null;
}

/**
 * Wraps a toolbar filter control for mobile sheet — visible label, full width, 44px touch target.
 */
export default function MobileFilterField({ children, label: labelOverride }) {
  if (!isValidElement(children)) {
    return <div className="w-full min-w-0">{children}</div>;
  }

  const label = labelOverride || resolveFieldLabel(children);
  const isCompactDropdown = children.props?.variant === 'compact';

  const enhanced = cloneElement(children, {
    className: `${stripFixedWidths(children.props?.className || '')} w-full max-w-full min-w-0`.trim(),
    ...(isCompactDropdown ? { variant: 'default' } : {}),
  });

  return (
    <div className="w-full min-w-0 space-y-1.5">
      {label && (
        <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
          {label}
        </span>
      )}
      <div className="w-full min-w-0 [&_button]:min-h-[44px]">{enhanced}</div>
    </div>
  );
}

export { isSearchInputElement, isMobileInlineElement } from './toolbarMobilePartition';
