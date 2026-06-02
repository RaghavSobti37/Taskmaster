/** ESM helper — keep in sync with shared/dataInlets.js dedupeInletEntries */
export function dedupeInletEntries(inlets = []) {
  const map = new Map();
  for (const inlet of inlets) {
    if (!inlet?.key) continue;
    if (!map.has(inlet.key)) {
      map.set(inlet.key, inlet);
    }
  }
  return [...map.values()];
}
