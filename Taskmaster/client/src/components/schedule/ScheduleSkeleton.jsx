import React from 'react';
import { Skeleton } from '../ui/primitives';

const ScheduleSkeleton = ({
  compact = false,
  showStatCards = false,
  departmentCount = 2,
  memberRowsPerDept = 4,
  hideTableHeader = false,
  dayCount = 2,
}) => {
  const slotCount = dayCount * 2;
  const colSpan = 1 + slotCount;
  const memberPad = compact ? 'px-2 py-1.5' : 'px-2.5 py-2';
  const cellPad = compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5';
  const taskStackClass = compact ? 'flex gap-0.5' : 'flex flex-col gap-0.5';
  const cellAlign = compact ? 'align-middle' : 'align-top';

  return (
    <div className="space-y-4" aria-busy="true" aria-label="Please wait">
      {showStatCards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-[var(--color-bg-border)] pb-4 space-y-2">
              <Skeleton height={10} width="55%" />
              <Skeleton height={28} width="40%" />
            </div>
          ))}
        </div>
      )}

      <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-surface)]">
        <table className="w-full min-w-[640px] text-xs">
          {!hideTableHeader && (
            <thead>
              <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
                <th className={`text-left ${memberPad} w-36`}>
                  <Skeleton height={9} width={48} />
                </th>
                {[...Array(dayCount)].map((_, col) => (
                  <th key={col} colSpan={2} className="text-center px-1.5 py-1 border-l border-[var(--color-bg-border)]">
                    <Skeleton height={9} width={40} className="mx-auto mb-0.5" />
                    <Skeleton height={9} width={64} className="mx-auto" />
                  </th>
                ))}
              </tr>
              <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
                <th />
                {[...Array(slotCount)].map((_, slot) => (
                  <th key={slot} className="text-center px-1 py-0.5 border-l border-[var(--color-bg-border)]">
                    <Skeleton height={8} width={56} className="mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {[...Array(departmentCount)].map((_, dept) => (
              <React.Fragment key={dept}>
                <tr className="bg-[var(--color-bg-secondary)]/40">
                  <td colSpan={colSpan} className="px-2.5 py-1 border-b border-t border-[var(--color-bg-border)]">
                    <Skeleton height={10} width={dept === 0 ? 88 : 72} />
                  </td>
                </tr>
                {[...Array(compact ? 3 : memberRowsPerDept)].map((_, row) => (
                  <tr key={`${dept}-${row}`} className="border-b border-[var(--color-bg-border)]/60 hover:bg-[var(--color-bg-secondary)]/30">
                    <td className={`${memberPad} ${cellAlign}`}>
                      <div className="flex items-center gap-1.5">
                        <Skeleton height={compact ? 20 : 24} width={compact ? 20 : 24} className="!rounded-full shrink-0" />
                        <Skeleton height={11} width={row % 2 === 0 ? '60%' : '45%'} />
                      </div>
                    </td>
                    {[...Array(slotCount)].map((_, cell) => (
                      <td
                        key={cell}
                        className={`${cellPad} ${cellAlign} border-l border-[var(--color-bg-border)]/40 min-w-[90px]`}
                      >
                        {(row + cell + dept) % 3 !== 0 && (
                          <div className={taskStackClass}>
                            <Skeleton height={18} className="w-16 rounded" />
                            {(row + cell) % 2 === 0 && <Skeleton height={18} className="w-12 rounded" />}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleSkeleton;
