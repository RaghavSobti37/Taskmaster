const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const ASSET_TOKEN_RE = /^#asset[-_]?([a-f0-9]{24})$/i;
const ADD_NOTE_RE = /^add\s+note\s+(.+)$/i;

/**
 * Parse palette query for special tokens and actions.
 * @returns {{ kind: 'nav'|'note'|'asset'|'task'|null, path?: string, note?: { title: string, content: string }, taskId?: string, assetId?: string }}
 */
export function resolvePaletteQuery(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { kind: null };

  const assetMatch = trimmed.match(ASSET_TOKEN_RE);
  if (assetMatch) {
    return {
      kind: 'asset',
      assetId: assetMatch[1],
      path: `/assets?highlight=${assetMatch[1]}`,
    };
  }

  if (OBJECT_ID_RE.test(trimmed)) {
    return {
      kind: 'task',
      taskId: trimmed,
      path: `/todo?highlight=${trimmed}`,
    };
  }

  const noteMatch = trimmed.match(ADD_NOTE_RE);
  if (noteMatch) {
    const content = noteMatch[1].trim();
    const title = content.length > 48 ? `${content.slice(0, 45)}…` : content;
    return {
      kind: 'note',
      note: { title, content },
    };
  }

  return { kind: null };
}
