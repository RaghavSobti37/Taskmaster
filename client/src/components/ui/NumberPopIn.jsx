import React, { useLayoutEffect, useRef } from 'react';

/**
 * Animated number/text display (transitions.dev number pop-in).
 * Re-animates digits when `value` changes.
 */
export default function NumberPopIn({ value, className = '' }) {
  const groupRef = useRef(null);
  const prevRef = useRef(value);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const str = String(value ?? '');
    const shouldAnimate = prevRef.current !== value && prevRef.current !== undefined;
    prevRef.current = value;

    group.classList.remove('is-animating');
    group.replaceChildren();

    str.split('').forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 't-digit';
      span.textContent = ch;
      if (i === str.length - 2) span.dataset.stagger = '1';
      else if (i === str.length - 1) span.dataset.stagger = '2';
      group.appendChild(span);
    });

    void group.offsetHeight;
    if (shouldAnimate) group.classList.add('is-animating');
  }, [value]);

  return <span ref={groupRef} className={`t-digit-group ${className}`} />;
}
