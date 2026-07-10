/**
 * LOCKED stroke/fill props for HarmonicLogo — values from logoBrandTokens.js only.
 */
import { LOGO_MARK_FILL, LOGO_MARK_STROKE, LOGO_SPOKE_STROKE_WIDTH } from './logoBrandTokens';

const S = {
  stroke: LOGO_MARK_STROKE,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const logoThin = { ...S, strokeWidth: LOGO_SPOKE_STROKE_WIDTH };
export const logoDot = { fill: LOGO_MARK_FILL };
