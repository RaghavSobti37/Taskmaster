import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('supports row selection checkboxes', () => {
    const onChange = vi.fn();
    render(
      <DataTable
        columns={[{ header: 'Name', key: 'name' }]}
        data={[{ _id: 'a', name: 'Ada' }, { _id: 'b', name: 'Bob' }]}
        paginated={false}
        selectable
        selectedIds={[]}
        onSelectedIdsChange={onChange}
        getRowId={(row) => row._id}
      />,
    );

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(boxes[1]);
    expect(onChange).toHaveBeenCalled();
  });

  it('sorts sortable columns from keyboard activation', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={[{ header: 'Name', key: 'name' }]}
        data={[{ name: 'Bob' }, { name: 'Ada' }]}
        paginated={false}
      />,
    );

    screen.getByRole('button', { name: /sort by name/i }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('columnheader', { name: /name/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toEqual(['Ada', 'Bob']);
  });

  it('activates clickable rows from keyboard without hijacking nested controls', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[
          { header: 'Name', key: 'name' },
          {
            header: 'Action',
            key: 'action',
            render: () => <button type="button">Nested action</button>,
          },
        ]}
        data={[{ name: 'Ada' }]}
        paginated={false}
        onRowClick={onRowClick}
      />,
    );

    fireEvent.keyDown(screen.getByRole('row', { name: /ada/i }), { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);

    const table = screen.getByRole('table');
    fireEvent.keyDown(within(table).getByRole('button', { name: 'Nested action' }), {
      key: 'Enter',
      bubbles: true,
    });
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});
