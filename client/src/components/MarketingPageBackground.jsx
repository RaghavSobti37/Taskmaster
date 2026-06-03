import React from 'react';

/**
 * Decorative marketing/auth backgrounds. Isolated for content-visibility and lazy paint.
 */
export default function MarketingPageBackground({
  inkClassName = 'opacity-70 mix-blend-multiply dark:mix-blend-screen dark:opacity-30',
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-0 pointer-events-none bg-[url('/ink_spill_bg.png')] bg-cover bg-center ${inkClassName} [content-visibility:auto] [contain:strict]`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/patterns/pattern_0.png')] bg-repeat opacity-5 mix-blend-overlay [content-visibility:auto] [contain:strict]"
      />
    </>
  );
}
