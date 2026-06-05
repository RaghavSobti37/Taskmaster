import React, { useEffect, useState } from 'react';

export default function TaskCompletionFlash({ show = false, hours = 0.25, className = '' }) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return undefined;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, [show]);

  if (!visible) return null;

  return (
    <p
      className={`text-xs font-semibold text-[var(--color-action-primary)] animate-pulse ${className}`}
      role="status"
      aria-live="polite"
    >
      +{hours}h logged to Daily Tracker
    </p>
  );
}
