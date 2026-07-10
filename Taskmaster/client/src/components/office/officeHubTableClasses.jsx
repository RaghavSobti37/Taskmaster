import React from 'react';

/** Shared desktop table props + column width classes for Office hub list tables. */

export const OFFICE_TABLE_COL = {
  primary: 'office-col-primary',
  badge: 'office-col-badge',
  meta: 'office-col-meta',
  numeric: 'office-col-numeric',
  date: 'office-col-date',
  users: 'office-col-users',
};

export const OFFICE_TABLE_PROPS = {
  density: 'comfortable',
  className: 'office-hub-table',
  fitWidth: true,
  rowEstimateSize: 60,
  virtualize: false,
};

/** Primary column: title + optional subtitle with truncate + tooltip. */
export function OfficePrimaryCell({ title, subtitle }) {
  return (
    <div className="min-w-0">
      <span className="tm-data-primary office-hub-cell-primary block truncate" title={title}>
        {title}
      </span>
      {subtitle ? (
        <span className="office-hub-cell-secondary block truncate" title={subtitle}>
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

/** Secondary text cell with truncate + tooltip. */
export function OfficeMetaCell({ value, fallback = '—', className = '' }) {
  const display = value || fallback;
  return (
    <span
      className={`office-hub-cell-meta truncate block ${className}`.trim()}
      title={value || undefined}
    >
      {display}
    </span>
  );
}
