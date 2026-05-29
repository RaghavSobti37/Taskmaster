import React from 'react';
import { Card, Skeleton } from '../ui';

const ScheduleTableSkeleton = ({ rows = 4, compact = false }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
          <th className="text-left px-4 py-2 w-40">
            <Skeleton height={10} width={56} />
          </th>
          {[0, 1].map((col) => (
            <th key={col} colSpan={2} className="text-center px-2 py-2 border-l border-[var(--color-bg-border)]">
              <Skeleton height={10} width={48} className="mx-auto mb-1" />
              <Skeleton height={8} width={72} className="mx-auto" />
            </th>
          ))}
        </tr>
        <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
          <th />
          {[0, 1, 2, 3].map((slot) => (
            <th
              key={slot}
              className={`text-center px-2 py-1 border-l border-[var(--color-bg-border)] ${slot % 2 === 0 ? '' : ''}`}
            >
              <Skeleton height={8} width={64} className="mx-auto" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, row) => (
          <tr key={row} className="border-b border-[var(--color-bg-border)]/60">
            <td className="px-4 py-3 align-top">
              <Skeleton height={14} width={row % 2 === 0 ? '70%' : '55%'} />
              {!compact && <Skeleton height={8} width={40} className="mt-1.5" />}
            </td>
            {[0, 1, 2, 3].map((cell) => (
              <td
                key={cell}
                className="px-2 py-2 align-top border-l border-[var(--color-bg-border)]/40 min-w-[120px]"
              >
                {(row + cell) % 3 !== 0 && (
                  <>
                    <Skeleton height={8} width={36} className="mb-1" />
                    <Skeleton height={28} className="w-full rounded-lg" />
                  </>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ScheduleSkeleton = ({ compact = false, showStatCards = false, departmentCount = 2 }) => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading schedule">
    {showStatCards && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton height={10} width="55%" />
            <Skeleton height={28} width="40%" />
          </Card>
        ))}
      </div>
    )}

    {[...Array(departmentCount)].map((_, i) => (
      <Card key={i} className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-bg-border)] flex items-center gap-2">
          <Skeleton height={14} width={i === 0 ? 100 : 88} />
          <Skeleton height={20} width={72} className="rounded-full" />
        </div>
        <ScheduleTableSkeleton rows={compact ? 3 : 4} compact={compact} />
      </Card>
    ))}
  </div>
);

export default ScheduleSkeleton;
