import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { createPortal } from 'react-dom';
import { X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { nextSortDirection, compareSortValues } from '../../hooks/useColumnSort';

export const Skeleton = ({ className = '', variant = 'rect', width, height }) => {
  const variants = {
    rect: 'rounded-[var(--radius-atomic)]',
    circle: 'rounded-full',
    text: 'rounded-md h-3 w-full'
  };

  return (
    <div 
      className={`animate-pulse bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] ${variants[variant]} ${className}`}
      style={{ width, height }}
    />
  );
};

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-[var(--color-action-primary)] text-[var(--color-bg-primary)] hover:opacity-90 active:scale-[0.98]',
    secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]',
    ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
    danger: 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border border-[var(--color-pastel-rose-text)]/10 hover:bg-[var(--color-pastel-rose-text)]/10',
    mint: 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)] border border-[var(--color-pastel-mint-text)]/20 hover:bg-[var(--color-pastel-mint-text)]/10',
    success: 'bg-[var(--color-pastel-mint-text)] text-white border border-[var(--color-pastel-mint-text)] hover:opacity-90',
  };

  const sizes = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button 
      className={`rounded-[var(--radius-atomic)] font-semibold transition-all inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', hover = false, variant = 'surface', ...props }) => {
  const variants = {
    surface: 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)]',
    secondary: 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]',
  };

  return (
    <div 
      className={`rounded-[var(--radius-atomic)] border shadow-sm transition-all ${variants[variant]} ${hover ? 'hover:border-[var(--color-action-primary)]/50 cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const PageContainer = ({ children, className = '', maxWidth = '1600px' }) => (
  <div
    data-page-root
    className={`mx-auto px-4 py-4 space-y-4 pb-16 min-w-0 max-w-full overflow-x-clip ${className}`}
    style={{ maxWidth }}
  >
    {children}
  </div>
);

export const TabSwitcher = ({ tabs, activeTab, onChange, className = '' }) => (
  <div className={`flex flex-wrap lg:flex-nowrap items-center gap-1 bg-[var(--color-bg-secondary)] p-1 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] max-w-full overflow-x-hidden ${className}`}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-[var(--radius-atomic)] whitespace-nowrap shrink-0 ${
          activeTab === tab.id
            ? 'bg-[var(--color-bg-surface)] text-[var(--color-action-primary)] shadow-sm border border-[var(--color-bg-border)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

/** Wraps a single form control so it sizes correctly in flex/grid layouts. */
export const FormField = ({ children, className = '' }) => (
  <div className={`w-full min-w-0 shrink-0 ${className}`}>{children}</div>
);

/** Responsive field layout — flex-based to avoid CSS grid min-content collapse. */
export const FormFieldGrid = ({ children, columns = 2, className = '' }) => {
  const childArray = React.Children.toArray(children).filter(Boolean);
  if (columns <= 1) {
    return <div className={`flex flex-col gap-6 w-full ${className}`}>{childArray}</div>;
  }
  return (
    <div
      className={`grid w-full gap-6 grid-cols-1 md:[grid-template-columns:repeat(2,minmax(0,1fr))] ${className}`}
    >
      {childArray.map((child, i) => (
        <div key={i} className="w-full min-w-0">
          {child}
        </div>
      ))}
    </div>
  );
};

export const Input = ({ label, icon: Icon, multiline = false, rows = 4, className = '', endAdornment, error, hint, ...props }) => (
  <div className="flex flex-col gap-2 w-full min-w-0">
    {label && (
      <label className="block tm-section-label">
        {label}
      </label>
    )}
    <div className="relative isolate w-full min-w-0 overflow-hidden">
      {Icon && !multiline && (
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none z-[1]" />
      )}
      {multiline ? (
        <textarea
          rows={rows}
          aria-invalid={error ? 'true' : undefined}
          className={`block w-full min-w-0 min-h-[5rem] p-3 bg-[var(--color-bg-primary)] border rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-sm resize-y ${
            error ? 'border-rose-500 focus:border-rose-500' : 'border-[var(--color-bg-border)]'
          } ${className}`}
          {...props}
        />
      ) : (
        <input
          aria-invalid={error ? 'true' : undefined}
          className={`block w-full min-w-0 min-h-[2.5rem] ${Icon ? 'pl-9' : 'px-3'} ${endAdornment ? 'pr-9' : 'pr-3'} py-2 bg-[var(--color-bg-primary)] border rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-sm ${
            error ? 'border-rose-500 focus:border-rose-500' : 'border-[var(--color-bg-border)]'
          } ${className}`}
          {...props}
        />
      )}
      {endAdornment && !multiline && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center">
          {endAdornment}
        </div>
      )}
    </div>
    {error && <p className="text-[10px] font-bold text-rose-400">{error}</p>}
    {hint && !error && <p className="text-[10px] font-bold text-amber-400">{hint}</p>}
  </div>
);

export const Badge = ({ children, variant = 'info', className = '' }) => {
  const variants = {
    success: 'badge-mint',
    complete: 'badge-mint',
    converted: 'badge-mint',
    warning: 'badge-apricot',
    'in-progress': 'badge-apricot',
    danger: 'badge-rose',
    overdue: 'badge-rose',
    hot: 'badge-rose',
    high: 'badge-apricot',
    critical: 'badge-rose',
    medium: 'badge-medium',
    info: 'badge-slate',
    neutral: 'badge-slate',
    fresh: 'badge-slate',
    low: 'badge-slate'
  };

  return (
    <span className={`badge-pastel ${variants[variant] || 'badge-slate'} ${className}`}>
      {children}
    </span>
  );
};

export const InfoButton = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="inline-flex items-center ml-1.5 align-middle relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <button 
        type="button"
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[10px] font-mono font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-action-primary)] hover:text-[var(--color-bg-primary)] transition-colors cursor-help focus:outline-none"
      >
        i
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-black text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl w-48 z-[99999] pointer-events-none text-center border border-white/20">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-900 dark:border-t-black" />
        </div>
      )}
    </div>
  );
};

export const StatCard = ({ label, value, icon: Icon, variant = 'slate', subValue, info, children, onClick, className = '' }) => {
  const variants = {
    info: 'border-[var(--color-pastel-blue-text)]/20 bg-[var(--color-pastel-blue-bg)] text-[var(--color-pastel-blue-text)]',
    mint: 'border-[var(--color-pastel-mint-text)]/20 bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]',
    rose: 'border-[var(--color-pastel-rose-text)]/20 bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)]',
    apricot: 'border-[var(--color-pastel-apricot-text)]/20 bg-[var(--color-pastel-apricot-bg)] text-[var(--color-pastel-apricot-text)]',
    slate: 'border-[var(--color-pastel-slate-text)]/20 bg-[var(--color-pastel-slate-bg)] text-[var(--color-pastel-slate-text)]',
  };

  return (
    <Card 
      onClick={onClick} 
      className={`p-3 flex flex-col gap-2 !rounded-[var(--radius-atomic)] border-l-2 ${variants[variant]} ${onClick ? 'cursor-pointer hover:border-[var(--color-action-primary)]/50 active:scale-[0.99] transition-transform' : ''} h-full ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 opacity-70">
          <Icon size={12} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {label}
            {info && <InfoButton text={info} />}
          </span>
        </div>
        {subValue && <Badge variant={variant} className="!py-0 !px-1.5 !text-[9px] font-black">{subValue}</Badge>}
      </div>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-2xl font-black tracking-tighter text-[var(--color-text-primary)] leading-none">{value}</span>
        <div className="flex-shrink-0 flex items-center justify-end">
          {children}
        </div>
      </div>
    </Card>
  );
};

export const TablePagination = ({
  pageSize,
  currentPage,
  totalPages,
  totalItems,
  rowCount = 0,
  onPageChange,
  onPageSizeChange,
}) => {
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + (rowCount || pageSize), totalItems);

  return (
    <div className="p-3 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-[var(--color-text-muted)]">
      <div className="flex items-center gap-2">
        <span>Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded text-[11px] font-bold outline-none text-[var(--color-text-primary)]"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>entries</span>
        <span className="text-[10px] font-bold opacity-60 ml-2">
          (Showing {totalItems === 0 ? 0 : startIndex + 1}-{endIndex} of {totalItems})
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-border)] border border-[var(--color-bg-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed text-[10px] uppercase tracking-wider transition-colors"
        >
          First
        </button>
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-2 py-1 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-border)] border border-[var(--color-bg-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed text-[10px] uppercase tracking-wider transition-colors"
        >
          Prev
        </button>
        <span className="px-3 text-xs text-[var(--color-text-primary)]">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-2 py-1 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-border)] border border-[var(--color-bg-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed text-[10px] uppercase tracking-wider transition-colors"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-border)] border border-[var(--color-bg-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed text-[10px] uppercase tracking-wider transition-colors"
        >
          Last
        </button>
      </div>
    </div>
  );
};

export const DataTable = ({ 
  columns, 
  data = [], 
  onRowClick,
  getRowId,
  className = '', 
  defaultPageSize = 10, 
  paginated = true,
  serverSide = false,
  totalItems: customTotalItems,
  totalPages: customTotalPages,
  currentPage: customCurrentPage,
  onPageChange,
  onPageSizeChange,
  pageSize: customPageSize,
  emptyTitle = 'No results',
  emptyDescription = 'Nothing matches your filters yet.',
  isLoading = false,
  fitWidth = false,
  sortState: controlledSortState,
  onSortChange,
}) => {
  const [localSortState, setLocalSortState] = useState(null);
  const sortState = controlledSortState !== undefined ? controlledSortState : localSortState;
  const setSortState = onSortChange || setLocalSortState;

  const sortedData = useMemo(() => {
    if (serverSide || !sortState?.key || !sortState.direction) return data;
    const col = columns.find((c) => (c.sortKey || c.key) === sortState.key);
    const getVal = (row) => {
      if (col?.sortFn) return col.sortFn(row);
      if (col?.key) return row[col.key];
      return row[sortState.key];
    };
    const dir = sortState.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => compareSortValues(getVal(a), getVal(b)) * dir);
  }, [data, sortState, serverSide, columns]);

  const handleSortClick = useCallback(
    (col) => {
      const key = col.sortKey || col.key;
      if (!key || col.sortable === false) return;
      const nextDir = nextSortDirection(sortState, key, key);
      setSortState(nextDir ? { key, direction: nextDir } : null);
    },
    [sortState, setSortState]
  );

  const [localCurrentPage, setLocalCurrentPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(defaultPageSize);

  const currentPage = serverSide ? (customCurrentPage || 1) : localCurrentPage;
  const pageSize = serverSide ? (customPageSize || defaultPageSize) : localPageSize;
  const setCurrentPage = serverSide ? onPageChange : setLocalCurrentPage;
  const setPageSize = serverSide ? onPageSizeChange : setLocalPageSize;

  const tableData = sortedData;
  const totalItems = serverSide ? (customTotalItems || 0) : tableData.length;
  const totalPages = serverSide ? (customTotalPages || 1) : (Math.ceil(totalItems / pageSize) || 1);

  // Reset page when data changes (only client-side)
  useEffect(() => {
    if (!serverSide) {
      setLocalCurrentPage(1);
    }
  }, [tableData.length, serverSide]);

  useEffect(() => {
    if (!serverSide) {
      setLocalCurrentPage(1);
    }
  }, [sortState?.key, sortState?.direction, serverSide]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = serverSide ? Math.min(startIndex + tableData.length, totalItems) : Math.min(startIndex + pageSize, totalItems);
  const paginatedData = paginated && !serverSide ? tableData.slice(startIndex, endIndex) : tableData;
  const showEmpty = !isLoading && paginatedData.length === 0;

  const parentRef = useRef();

  const rowVirtualizer = useVirtualizer({
    count: paginatedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  const mobileColumns = columns.filter((c) => !c.mobileHidden);
  const primaryCol = columns.find((c) => c.mobilePrimary) || mobileColumns[0];
  const detailColumns = mobileColumns.filter((c) => c !== primaryCol);
  const actionColumns = columns.filter((c) => c.mobileAction);

  return (
    <div className={`w-full flex flex-col border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-surface)] ${className}`}>
      <div
        ref={parentRef}
        className={`w-full max-lg:overflow-visible lg:overflow-y-auto lg:max-h-[600px] custom-scrollbar overflow-x-clip ${fitWidth ? '' : 'lg:overflow-x-auto'}`}
      >
        <table
          className={`w-full text-left border-collapse hidden lg:table ${fitWidth ? 'table-fixed' : 'min-w-[540px]'}`}
        >
          <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
            <tr>
              {columns.map((col, i) => {
                const sortKey = col.sortKey || col.key;
                const sortable = Boolean(sortKey && col.sortable !== false);
                const active = Boolean(
                  sortState?.key && sortKey && sortState.key === sortKey && sortState.direction
                );
                const SortIcon = active
                  ? sortState.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                return (
                  <th
                    key={i}
                    className={`px-4 py-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap ${
                      sortable ? 'cursor-pointer select-none hover:text-[var(--color-text-primary)]' : ''
                    }`}
                    onClick={sortable ? () => handleSortClick(col) : undefined}
                    aria-sort={
                      active
                        ? (sortState.direction === 'asc' ? 'ascending' : 'descending')
                        : 'none'
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.info && <InfoButton text={col.info} />}
                      {sortable && (
                        <SortIcon
                          size={12}
                          className={active ? 'text-[var(--color-action-primary)]' : 'opacity-40'}
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{emptyTitle}</p>
                  {emptyDescription && (
                    <p className="mt-2 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">{emptyDescription}</p>
                  )}
                </td>
              </tr>
            ) : (
              <>
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} />
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = paginatedData[virtualRow.index];
              const rowId = getRowId?.(row);
              return (
                <tr 
                  key={virtualRow.index}
                  data-highlight-id={rowId || undefined}
                  onClick={(e) => {
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                    onRowClick?.(row);
                  }}
                  className="data-table-row cursor-pointer transition-none relative group hover:bg-[var(--color-bg-secondary)]"
                  style={{ height: `${virtualRow.size}px` }}
                >
                  {columns.map((col, j) => (
                    <td
                      key={j}
                      className={`px-4 py-2 text-sm text-[var(--color-text-primary)] ${fitWidth ? 'max-w-0 truncate' : ''} ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }} />
            )}
              </>
            )}
          </tbody>
        </table>

        {/* Mobile Responsive Card Stack (< lg) */}
        <div className="grid grid-cols-1 gap-3 p-3 lg:hidden">
          {showEmpty ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{emptyTitle}</p>
              {emptyDescription && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{emptyDescription}</p>}
            </div>
          ) : paginatedData.map((row, i) => (
            <div
              key={i}
              data-highlight-id={getRowId?.(row) || undefined}
              onClick={(e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
                onRowClick?.(row);
              }}
              className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] cursor-pointer shadow-sm active:scale-[0.99] transition-transform min-w-0"
            >
              {primaryCol && (
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--color-text-primary)] min-w-0">
                    {primaryCol.render ? primaryCol.render(row) : row[primaryCol.key]}
                  </div>
                  {primaryCol.mobileSubtitle && (
                    <div className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                      {typeof primaryCol.mobileSubtitle === 'function'
                        ? primaryCol.mobileSubtitle(row)
                        : row[primaryCol.mobileSubtitle]}
                    </div>
                  )}
                </div>
              )}
              {detailColumns.length > 0 && (
                <dl className="mt-3 space-y-2 border-t border-[var(--color-bg-border)] pt-3">
                  {detailColumns.map((col, j) => (
                    <div key={j} className="flex flex-col gap-0.5 min-w-0">
                      <dt className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{col.header}</dt>
                      <dd className="text-sm text-[var(--color-text-primary)] min-w-0 break-words">
                        {col.render ? col.render(row) : row[col.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {actionColumns.length > 0 && (
                <div
                  className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-[var(--color-bg-border)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actionColumns.map((col, j) => (
                    <div key={j} className="flex-1 min-w-[120px]">
                      {col.render ? col.render(row) : row[col.key]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {paginated && totalItems > 0 && (
        <TablePagination
          pageSize={pageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          rowCount={serverSide ? data.length : Math.min(pageSize, totalItems - startIndex)}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
};

export const FullScreenWorkspace = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  sidebar,
  onSave,
  onCancel,
  hasChanges = false,
  saveDisabled = false,
  isSaving = false,
  extraActions,
  mainClassName = 'max-w-4xl',
}) => {
  const dirty = isOpen && hasChanges && !!onSave;

  useUnsavedChanges({
    hasChanges: dirty && !saveDisabled,
    onSave,
    onCancel: onCancel || onClose,
    isSaving,
    enabled: dirty,
    elevated: true,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[500] bg-[var(--color-bg-primary)] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Top Bar Navigation */}
          <div className="h-14 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between px-4 sm:px-6 shrink-0">
             <div className="flex items-center gap-2 sm:gap-4 min-w-0 pr-2">
                <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors shrink-0">
                   <X size={20} />
                </button>
                <div className="min-w-0">
                   <h2 className="text-xs sm:text-sm font-black uppercase tracking-tight leading-none truncate">{title}</h2>
                   {subtitle && <p className="text-[9px] sm:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1 truncate">{subtitle}</p>}
                </div>
             </div>
             {extraActions ? (
               <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                 {extraActions}
               </div>
             ) : null}
          </div>

          {/* Main Layout Partition */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
             {/* Left Column: Canvas */}
             <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
             <div className={`${mainClassName} mx-auto space-y-6 lg:space-y-8`}>
                   {children}
                </div>
             </div>

             {/* Right Column: Utility Drawer */}
             <aside className="w-full lg:w-[320px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                <div className="space-y-6">
                   {sidebar}
                </div>
             </aside>
          </div>
        </div>
      )}
    </>
  );
};

export const ProgressBar = ({ progress, color = 'bg-[var(--color-action-primary)]' }) => (
  <div className="w-full h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
    <div
      className={`h-full ${color} transition-all duration-300 ease-out`}
      style={{ width: `${progress}%` }}
    />
  </div>
);

export const Switch = ({ checked, onChange, disabled = false, className = '' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-[var(--color-action-primary)]' : 'bg-[var(--color-text-muted)]'} ${className}`}
  >
    <span
      className={`pointer-events-none block h-4 w-4 rounded-full bg-[var(--color-bg-surface)] shadow-sm ring-0 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
    />
  </button>
);

export const Accordion = ({ items, className = '' }) => {
  const [openIndex, setOpenIndex] = useState(null);
  
  return (
    <div className={`space-y-2 w-full ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden bg-[var(--color-bg-surface)]">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus:outline-none"
          >
            {item.title}
            <div className={`transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </div>
          </button>
          {openIndex === i && (
            <div className="overflow-hidden bg-[var(--color-bg-secondary)] animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="p-4 pt-2 text-sm text-[var(--color-text-secondary)]">
                {item.content}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
