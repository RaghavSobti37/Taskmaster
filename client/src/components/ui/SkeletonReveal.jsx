import React, { useEffect, useRef } from 'react';

/**
 * Cross-fade from skeleton pulse to loaded content (transitions.dev skeleton-reveal).
 */
export default function SkeletonReveal({ loading, skeleton, children, className = '' }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (loading || !rootRef.current) return;
    const root = rootRef.current;
    root.classList.add('is-revealed');
  }, [loading]);

  if (loading) {
    return (
      <div className={`t-skel ${className}`} data-state="loading">
        <div className="t-skel-skeleton is-pulsing relative min-h-[12rem]">{skeleton}</div>
        <div className="t-skel-content" aria-hidden />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`t-skel ${className}`} data-state="loaded">
      <div className="t-skel-skeleton is-pulsing" aria-hidden />
      <div className="t-skel-content relative">{children}</div>
    </div>
  );
}
