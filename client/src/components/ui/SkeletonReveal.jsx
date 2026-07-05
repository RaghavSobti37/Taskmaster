import React, { useEffect, useRef } from 'react';

/**
 * Cross-fade skeleton → content (transitions.dev). Use `reveal` only for inline widgets;
 * page loads should swap without a lingering absolute skeleton layer.
 */
export default function SkeletonReveal({ loading, skeleton, children, className = '', reveal = false }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!reveal || loading || !rootRef.current) return;
    const root = rootRef.current;
    root.classList.add('is-revealed');
  }, [loading, reveal]);

  if (loading) {
    return (
      <div className={`t-skel ${className}`.trim()} data-state="loading" aria-busy="true">
        <div className="t-skel-skeleton is-pulsing relative min-h-[8rem]">{skeleton}</div>
      </div>
    );
  }

  if (!reveal) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={rootRef} className={`t-skel ${className}`.trim()} data-state="loaded">
      <div className="t-skel-content relative">{children}</div>
    </div>
  );
}
