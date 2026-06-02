import React from 'react';

export default function DeltaBadge({ value, direction = 'up', className = '' }) {
  const isDown = direction === 'down';
  return (
    <span className={`${isDown ? 'tm-delta-negative' : 'tm-delta-positive'} ${className}`}>
      {isDown ? '↓' : '↑'} {value}
    </span>
  );
}
