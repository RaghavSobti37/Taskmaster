import { useCallback, useMemo, useState } from 'react';

/** Cycle: null (default) → asc → desc → null */
export function nextSortDirection(current, sortKey, columnKey) {
  if (current?.key !== columnKey) return 'asc';
  if (current.direction === 'asc') return 'desc';
  if (current.direction === 'desc') return null;
  return 'asc';
}

export function compareSortValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const sa = String(a).toLowerCase();
  const sb = String(b).toLowerCase();
  return sa.localeCompare(sb, undefined, { numeric: true });
}

/**
 * @param {object} options
 * @param {{ key: string, direction: 'asc'|'desc' }|null} options.controlledState
 * @param {(state: { key: string, direction: 'asc'|'desc' }|null) => void} options.onSortChange
 * @param {Array} options.data
 * @param {Array} options.columns - DataTable columns with sortKey/sortFn
 */
export function useColumnSort({
  controlledState,
  onSortChange,
  data = [],
  columns = [],
} = {}) {
  const [internalState, setInternalState] = useState(null);
  const sortState = controlledState !== undefined ? controlledState : internalState;
  const setSortState = onSortChange || setInternalState;

  const handleHeaderClick = useCallback(
    (column) => {
      const key = column.sortKey || column.key;
      if (!key || column.sortable === false) return;
      const nextDir = nextSortDirection(sortState, key, key);
      setSortState(nextDir ? { key, direction: nextDir } : null);
    },
    [sortState, setSortState]
  );

  const sortedData = useMemo(() => {
    if (!sortState?.key || !sortState.direction) return data;
    const col = columns.find(
      (c) => (c.sortKey || c.key) === sortState.key
    );
    const getVal = (row) => {
      if (col?.sortFn) return col.sortFn(row);
      if (col?.key) return row[col.key];
      return row[sortState.key];
    };
    const dir = sortState.direction === 'asc' ? 1 : -1;
    return [...data].sort((ra, rb) => compareSortValues(getVal(ra), getVal(rb)) * dir);
  }, [data, sortState, columns]);

  return { sortState, setSortState, handleHeaderClick, sortedData };
}
