/** Decimal hours → "10h 54m" (nearest minute). Zero → "0h". */
export function formatHoursMinutes(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return '0h';

  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
