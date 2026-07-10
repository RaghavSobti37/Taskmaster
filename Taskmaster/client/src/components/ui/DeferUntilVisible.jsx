import React, { useEffect, useRef, useState } from 'react';

/**
 * Renders children only after the placeholder enters the viewport (or immediately when reduced motion).
 */
export default function DeferUntilVisible({
  children,
  fallback = null,
  rootMargin = '120px',
  className = '',
  minHeight = 0,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    if (typeof window === 'undefined') return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced) {
      setVisible(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  if (visible) return children;

  return (
    <div ref={ref} className={className} style={minHeight ? { minHeight } : undefined}>
      {fallback}
    </div>
  );
}
