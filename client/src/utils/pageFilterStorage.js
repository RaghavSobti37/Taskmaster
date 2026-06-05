/** Persist page filter state in localStorage with safe parse/write. */

export function loadPageFilters(key, defaults = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function savePageFilters(key, values) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* quota / private mode */
  }
}
