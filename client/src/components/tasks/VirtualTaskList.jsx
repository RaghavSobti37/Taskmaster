import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Virtualized mobile task list — renders only visible rows for large lists.
 */
export default function VirtualTaskList({ items, renderItem, estimateSize = 120, className = '' }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 4,
  });

  if (!items.length) return null;

  return (
    <div ref={parentRef} className={`max-h-[70vh] overflow-y-auto custom-scrollbar ${className}`}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item?._id || virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
