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
    // #region agent log
    fetch('http://127.0.0.1:7593/ingest/75bc4ee5-8ab2-4010-83b9-7267b331142a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c0551d' },
      body: JSON.stringify({
        sessionId: 'c0551d',
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'SkeletonReveal.jsx:loading',
        message: 'SkeletonReveal loading layer',
        data: { reveal, className },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
