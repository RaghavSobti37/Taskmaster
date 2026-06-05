const STORAGE_KEY = 'coreknot_note_drafts_v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota exceeded — best effort */
  }
}

export function purgeExpiredNoteDrafts() {
  const store = readStore();
  const now = Date.now();
  let changed = false;
  Object.keys(store).forEach((key) => {
    const draft = store[key];
    if (!draft?.updatedAt || now - draft.updatedAt > DRAFT_TTL_MS) {
      delete store[key];
      changed = true;
    }
  });
  if (changed) writeStore(store);
  return store;
}

export function getNoteDraft(draftId) {
  const store = purgeExpiredNoteDrafts();
  return store[draftId] || null;
}

export function getAllNoteDrafts() {
  const store = purgeExpiredNoteDrafts();
  return Object.values(store).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveNoteDraft(draftId, payload) {
  if (!draftId) return;
  const store = purgeExpiredNoteDrafts();
  store[draftId] = {
    id: draftId,
    title: payload.title || '',
    content: payload.content || '',
    format: payload.format || 'html',
    updatedAt: Date.now(),
  };
  writeStore(store);
}

export function clearNoteDraft(draftId) {
  if (!draftId) return;
  const store = readStore();
  if (!store[draftId]) return;
  delete store[draftId];
  writeStore(store);
}

const stripDraftHtml = (html) =>
  (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

export function normalizeNoteFields(title, content) {
  return {
    title: (title || '').trim(),
    content: content || '',
  };
}

/** True when current fields differ from last saved baseline (ignores empty composer). */
export function hasUnsavedNoteFields(current, baseline) {
  const cur = normalizeNoteFields(current?.title, current?.content);
  const base = normalizeNoteFields(baseline?.title, baseline?.content);
  if (!cur.title && !stripDraftHtml(cur.content)) return false;
  return cur.title !== base.title || cur.content !== base.content;
}

/** Drop local drafts that match an already-saved note. */
export function isNoteDraftStale(draft, savedNote) {
  if (!draft) return false;
  if (!savedNote) return true;
  return hasUnsavedNoteFields(
    { title: draft.title, content: draft.content },
    { title: savedNote.title, content: savedNote.content }
  );
}

export function purgeMatchingNoteDraft(draftId, savedNote) {
  const draft = getNoteDraft(draftId);
  if (draft && savedNote && !isNoteDraftStale(draft, savedNote)) {
    clearNoteDraft(draftId);
  }
}

export function noteDraftTimeRemaining(draft) {
  if (!draft?.updatedAt) return 0;
  return Math.max(0, DRAFT_TTL_MS - (Date.now() - draft.updatedAt));
}

export function formatDraftExpiry(draft) {
  const ms = noteDraftTimeRemaining(draft);
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}
