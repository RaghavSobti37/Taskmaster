/** Human-readable list of dirty fields between draft and baseline snapshots. */
export function getFormFieldChanges(draft, baseline, { labels = {}, exclude = [] } = {}) {
  if (!draft || !baseline) return [];

  const changes = [];
  const keys = new Set([...Object.keys(draft), ...Object.keys(baseline)]);

  for (const key of keys) {
    if (exclude.includes(key)) continue;
    const oldVal = baseline[key];
    const newVal = draft[key];
    try {
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
    } catch {
      if (oldVal === newVal) continue;
    }
    const fmt = (v) => (v === '' || v == null ? '(empty)' : String(v));
    changes.push({
      field: key,
      label: labels[key] || key,
      oldValue: fmt(oldVal),
      newValue: fmt(newVal),
    });
  }

  return changes;
}
