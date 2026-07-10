import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import MonthlyAttendanceGrid from './MonthlyAttendanceGrid';

describe('MonthlyAttendanceGrid', () => {
  it('renders tooltip from manual timestamps and lock copy', () => {
    const month = new Date('2026-06-01T00:00:00.000Z');
    const date = new Date('2026-06-01T00:00:00.000Z');
    const userId = 'u-1';
    const rowMap = new Map([
      [
        `${userId}_${format(date, 'yyyy-MM-dd')}`,
        {
          userId,
          date,
          inTimeRecord: { manualTimestamp: '09:00', isApproved: true },
          outTimeRecord: { manualTimestamp: '18:00', isApproved: false },
        },
      ],
    ]);

    render(
      <MonthlyAttendanceGrid
        month={month}
        onMonthChange={vi.fn()}
        rowMap={rowMap}
        users={[{ _id: userId, name: 'Alex' }]}
        approvedLeaves={[]}
        resolveStatus={() => 'present'}
        onEdit={vi.fn()}
      />
    );

    const titledButton = screen
      .getAllByRole('button')
      .find((node) => String(node.getAttribute('title') || '').includes('In: 09:00 (Locked)'));

    expect(titledButton).toBeTruthy();
    expect(titledButton.getAttribute('title')).toContain('Out: 18:00');
    expect(screen.getByText(/Blue ring indicates fully approved and locked attendance/i)).toBeTruthy();
  });
});
