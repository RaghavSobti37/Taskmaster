/** Persist page filter state in localStorage with safe parse/write. */

import { scopedStorageKey } from '../lib/tenantSession';

export function loadPageFilters(key, defaults = {}, tenantId) {
  const storageKey = scopedStorageKey(key, tenantId);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function savePageFilters(key, values, tenantId) {
  const storageKey = scopedStorageKey(key, tenantId);
  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    /* quota / private mode */
  }
}
