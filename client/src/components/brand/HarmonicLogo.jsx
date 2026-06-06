import React from 'react';
import { HARMONIC_SPOKE_PATHS, HUB_X, HUB_Y } from './logoHarmonicGeometry';
import { LOGO_HUB_R, LOGO_MARK_SCALE } from './logoBrandTokens';
import { logoDot, logoThin } from './logoMarkStyles';

const markTransform = `translate(${HUB_X} ${HUB_Y}) scale(${LOGO_MARK_SCALE}) translate(${-HUB_X} ${-HUB_Y})`;

/** #99 — The Harmonic Frequency (locked geometry + white-on-green colors) */
function HarmonicLogo({ className, ...rest }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...rest}>
      <g transform={markTransform}>
        {HARMONIC_SPOKE_PATHS.map((d, i) => (
          <path key={i} d={d} {...logoThin} />
        ))}
        <circle cx={HUB_X} cy={HUB_Y} r={LOGO_HUB_R} {...logoDot} />
      </g>
    </svg>
  );
}

export default HarmonicLogo;
