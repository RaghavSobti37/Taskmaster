/**
 * Selection filter panel — active-count and default-value helpers.
 *
 * @example Page migration pattern
 * ```jsx
 * const filterFields = useMemo(() => [
 *   { id: 'status', label: 'Status', type: 'radio', value, onChange, options, defaultValue: 'all' },
 * ], [status, ...]);
 *
 * <ListPageLayout
 *   toolbar={<SearchInput ... />}
 *   filterFields={filterFields}
 *   mobileFilterCount={countActiveFilters(filterFields)}
 *   onActiveFiltersClear={handleClear}
 * />
 * ```
 * Search stays in `toolbar` (or `mobileSearch`); all NexusDropdown toolbar filters move into `filterFields`.
 */

export const FILTER_INACTIVE_VALUES = new Set(['', 'all', null, undefined]);

/** Resolve baseline for "no filter applied" per field type. */
export function resolveFilterDefault(field) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case 'toggle':
      return false;
    case 'chips':
      return [];
    case 'dateRange':
      return { start: '', end: '' };
    default:
      return 'all';
  }
}

/** Whether a single field config represents an active (non-default) filter. */
export function isFilterFieldActive(field) {
  if (!field) return false;
  const baseline = resolveFilterDefault(field);
  const { value, type } = field;

  if (type === 'toggle') return Boolean(value) !== Boolean(baseline);
  if (type === 'chips') return Array.isArray(value) && value.length > 0;
  if (type === 'dateRange') {
    const start = value?.start ?? '';
    const end = value?.end ?? '';
    return Boolean(start || end);
  }
  if (type === 'segmented') {
    return value !== baseline && !FILTER_INACTIVE_VALUES.has(value);
  }
  if (Array.isArray(value)) return value.length > 0;
  return value !== baseline && !FILTER_INACTIVE_VALUES.has(value);
}

/** Count active filters across a fields[] config (excludes search — keep search outside panel). */
export function countActiveFilters(fields = []) {
  return fields.filter(isFilterFieldActive).length;
}

/** Count draft fields that differ from applied baseline (deferred-apply panels). */
export function countPendingFilterChanges(draftFields = [], appliedFields = []) {
  const appliedById = new Map(appliedFields.map((f) => [f.id, f]));
  let pending = 0;
  for (const draft of draftFields) {
    const applied = appliedById.get(draft.id);
    if (!applied) continue;
    const draftBaseline = resolveFilterDefault(draft);
    const appliedBaseline = resolveFilterDefault(applied);
    const draftVal = draft.value ?? draftBaseline;
    const appliedVal = applied.value ?? appliedBaseline;
    if (JSON.stringify(draftVal) !== JSON.stringify(appliedVal)) pending += 1;
  }
  return pending;
}
