/** LOCKED — Harmonic Frequency mark — 6-fold hub at 32,32. See docs/LOGO_LOCKED.md */

export const HUB_X = 32;
export const HUB_Y = 32;

function hexPoint(i, r, startDeg = -90) {
  const a = ((startDeg + (i % 6) * 60) * Math.PI) / 180;
  return [HUB_X + r * Math.cos(a), HUB_Y + r * Math.sin(a)];
}

function hexAngleDeg(i, startDeg = -90) {
  return startDeg + (i % 6) * 60;
}

export function soundwaveSpoke(i, dist = 20) {
  const [x, y] = hexPoint(i, dist);
  const rad = (hexAngleDeg(i) * Math.PI) / 180;
  const px = x - Math.cos(rad) * 6;
  const py = y - Math.sin(rad) * 6;
  return `M ${px.toFixed(1)} ${py.toFixed(1)} Q ${x.toFixed(1)} ${(y - 4).toFixed(1)} ${(x + 4).toFixed(1)} ${y.toFixed(1)} Q ${HUB_X} ${HUB_Y} ${px.toFixed(1)} ${py.toFixed(1)}`;
}

export const HARMONIC_SPOKE_PATHS = Array.from({ length: 6 }, (_, i) => soundwaveSpoke(i));
