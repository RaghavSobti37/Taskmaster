import React from 'react';
import HarmonicLogo from '../brand/HarmonicLogo';

/** Faint sparkle watermark on auth panel ΓÇö uses mark geometry, not the app logo shell. */
export default function AuthSparkleWatermark() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      <HarmonicLogo
        className="h-[min(70vw,18rem)] w-[min(70vw,18rem)] opacity-[0.07] brightness-0 invert"
      />
    </div>
  );
}
