/** ponytail: RR history idx when present, else length heuristic */
export function canGoBackInHistory() {
  const idx = window.history.state?.idx;
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1;
}
