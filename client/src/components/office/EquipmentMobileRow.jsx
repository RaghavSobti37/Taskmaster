import React from 'react';
import { Badge } from '../ui/primitives';

export const equipmentStatusVariant = (status) => {
  if (status === 'Available') return 'success';
  if (status === 'In Use') return 'info';
  if (status === 'Maintenance') return 'warning';
  return 'danger';
};

const compactBadge = '!text-[9px] !px-1.5 !py-0 shrink-0';

/**
 * Dense 3-line mobile row for office equipment / assets lists (< lg).
 */
export default function EquipmentMobileRow({ asset }) {
  const serial = asset.serialNumber?.trim();
  const category = asset.category?.trim();
  const assigned = asset.currentlyWith?.trim();

  return (
    <div className="space-y-0.5 w-full min-w-0 py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="tm-data-primary text-sm font-bold truncate flex-1 min-w-0" title={asset.name}>
          {asset.name}
        </span>
        {asset.status ? (
          <Badge variant={equipmentStatusVariant(asset.status)} className={compactBadge}>
            {asset.status}
          </Badge>
        ) : null}
      </div>

      {serial ? (
        <p className="text-[10px] text-[var(--color-text-muted)] truncate tabular-nums" title={serial}>
          {serial}
        </p>
      ) : null}

      {(category || assigned) ? (
        <div className="flex items-center gap-1.5 min-w-0 text-[10px] text-[var(--color-text-muted)]">
          {category ? (
            <Badge variant="info" className={`${compactBadge} max-w-[55%] truncate`} title={category}>
              {category}
            </Badge>
          ) : null}
          {category && assigned ? (
            <span className="text-[var(--color-text-muted)]/70 shrink-0" aria-hidden>
              ·
            </span>
          ) : null}
          {assigned ? (
            <span className="truncate min-w-0" title={assigned}>
              {assigned}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
