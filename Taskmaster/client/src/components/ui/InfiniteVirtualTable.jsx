import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Virtualized table body — pair with useInfiniteQuery for paging.
 */
export default function InfiniteVirtualTable({
  rows = [],
  rowHeight = 44,
  renderRow,
  className = '',
  overscan = 8,
}) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={`overflow-auto ${className}`} style={{ maxHeight: '70vh' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderRow(row, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
