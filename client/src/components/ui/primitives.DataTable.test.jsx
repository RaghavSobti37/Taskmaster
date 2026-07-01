import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './primitives.jsx';

vi.mock('../../hooks/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

describe('DataTable', () => {
  it('unwraps directory envelope without slice crash', () => {
    expect(() =>
      render(
        <DataTable
          columns={[{ header: 'Name', key: 'name' }]}
          data={{ users: [{ name: 'Ada' }] }}
          paginated
        />,
      ),
    ).not.toThrow();

    expect(screen.getAllByText('Ada').length).toBeGreaterThan(0);
  });

  it('shows empty state for malformed non-array payloads', () => {
    render(
      <DataTable
        columns={[{ header: 'Name', key: 'name' }]}
        data={{ pagination: { total: 0 } }}
        paginated
        emptyTitle="No users"
      />,
    );

    expect(screen.getAllByText('No users').length).toBeGreaterThan(0);
  });

  it('uses overflow-visible table shell (page scroll only)', () => {
    const { container } = render(
      <DataTable
        columns={[{ header: 'Name', key: 'name' }]}
        data={[{ name: 'Ada' }]}
        paginated={false}
      />,
    );

    const shell = container.querySelector('.data-table-shell');
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveClass('overflow-visible');
    expect(shell.style.maxHeight).toBe('');
  });
});
