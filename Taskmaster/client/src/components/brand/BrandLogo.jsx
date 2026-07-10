import React from 'react';
import HarmonicLogo from './HarmonicLogo';

/** App brand mark — white Harmonic Frequency on green shell (locked presentation) */
export default function BrandLogo({ size = 40, className = '', title = 'CoreKnot' }) {
  return (
    <span
      role="img"
      aria-label={title}
      className={`brand-logo inline-flex shrink-0 items-center justify-center overflow-visible ${className}`}
      style={{ width: size, height: size }}
    >
      <HarmonicLogo className="h-full w-full" />
    </span>
  );
}
