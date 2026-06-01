/** Client ESM mirror of shared/mentionTokens.js — keep in sync */

const STOP_WORDS = new Set(['with', 'and', 'or', 'on', 'for', 'to', 'in', 'at', 'from']);
const ASSET_STOP_WORDS = new Set([
  ...STOP_WORDS,
  'ko', 'karo', 'please', 'review', 'de', 'kar', 'do', 'the', 'a', 'an', 'is', 'are',
]);

const normalizeLabel = (value) => String(value || '').trim().toLowerCase();

const uniqueLabels = (labels) => {
  const seen = new Set();
  const out = [];
  for (const label of labels) {
    const key = normalizeLabel(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label.trim());
  }
  return out;
};

const readWord = (text, index) => {
  const match = text.slice(index).match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  if (!match) return null;
  return { word: match[1], end: index + match[1].length };
};

const parseUserMention = (text, start) => {
  if (text[start] !== '@') return null;
  let index = start + 1;
  const first = readWord(text, index);
  if (!first) return null;

  const words = [first.word];
  index = first.end;

  if (text[index] === ' ') {
    const second = readWord(text, index + 1);
    if (second && !STOP_WORDS.has(second.word.toLowerCase())) {
      words.push(second.word);
      index = second.end;
    }
  }

  return { type: 'user', label: words.join(' '), raw: text.slice(start, index), end: index };
};

const parseAssetMention = (text, start) => {
  if (text[start] !== '#') return null;
  let index = start + 1;
  const words = [];

  while (index < text.length) {
    const part = readWord(text, index);
    if (!part) break;
    if (words.length > 0 && ASSET_STOP_WORDS.has(part.word.toLowerCase())) break;
    words.push(part.word);
    index = part.end;
    if (text[index] !== ' ') break;
    const peek = readWord(text, index + 1);
    if (!peek || text[index + 1] === '@' || text[index + 1] === '#') break;
    if (ASSET_STOP_WORDS.has(peek.word.toLowerCase())) break;
    index += 1;
  }

  if (!words.length) return null;
  return { type: 'asset', label: words.join(' '), raw: text.slice(start, index), end: index };
};

export const tokenizeMentionText = (text) => {
  if (!text) return [];

  const out = [];
  let cursor = 0;

  while (cursor < text.length) {
    const user = parseUserMention(text, cursor);
    const asset = !user ? parseAssetMention(text, cursor) : null;
    const token = user || asset;

    if (token && token.end > cursor) {
      const consumed = out.reduce((pos, seg) => {
        if (seg.type === 'text') return pos + seg.value.length;
        return pos + seg.raw.length;
      }, 0);
      if (consumed < cursor) {
        out.push({ type: 'text', value: text.slice(consumed, cursor) });
      }
      out.push({ type: token.type, label: token.label, raw: token.raw });
      cursor = token.end;
      continue;
    }

    cursor += 1;
  }

  const consumed = out.reduce((pos, seg) => {
    if (seg.type === 'text') return pos + seg.value.length;
    return pos + seg.raw.length;
  }, 0);
  if (consumed < text.length) {
    out.push({ type: 'text', value: text.slice(consumed) });
  }

  return out.length ? out : [{ type: 'text', value: text }];
};

export const extractUserMentionLabels = (text) => {
  const labels = tokenizeMentionText(text)
    .filter((seg) => seg.type === 'user')
    .map((seg) => seg.label);
  return uniqueLabels(labels);
};

export const extractAssetMentionLabels = (text) => {
  const labels = tokenizeMentionText(text)
    .filter((seg) => seg.type === 'asset')
    .map((seg) => seg.label);
  return uniqueLabels(labels);
};

export const extractUserMentionLabelsFromFields = (...texts) => {
  const labels = texts.flatMap((t) => extractUserMentionLabels(t || ''));
  return uniqueLabels(labels);
};

export const resolveUserByLabel = (label, users = []) => {
  const q = normalizeLabel(label);
  if (!q) return null;

  const exact = users.find((u) => normalizeLabel(u.name) === q);
  if (exact) return exact;

  const firstMatches = users.filter((u) => normalizeLabel(u.name?.split(/\s+/)[0]) === q);
  if (firstMatches.length === 1) return firstMatches[0];

  const emailMatches = users.filter((u) => normalizeLabel(u.email?.split('@')[0]) === q);
  if (emailMatches.length === 1) return emailMatches[0];

  const partial = users.filter((u) => normalizeLabel(u.name).includes(q));
  if (partial.length === 1) return partial[0];

  return null;
};

export const resolveAssetByLabel = (label, assets = []) => {
  const q = normalizeLabel(label);
  if (!q) return null;

  const exact = assets.find((a) => normalizeLabel(a.name) === q);
  if (exact) return exact;

  const starts = assets.filter((a) => normalizeLabel(a.name).startsWith(q));
  if (starts.length === 1) return starts[0];

  const partial = assets.filter((a) => normalizeLabel(a.name).includes(q));
  if (partial.length === 1) return partial[0];

  return null;
};

export const buildDisplaySegments = (text, users = [], assets = []) =>
  tokenizeMentionText(text).map((seg) => {
    if (seg.type === 'user') {
      const user = resolveUserByLabel(seg.label, users);
      return { ...seg, userId: user?._id || null, displayName: user?.name || seg.label };
    }
    if (seg.type === 'asset') {
      const asset = resolveAssetByLabel(seg.label, assets);
      return {
        ...seg,
        assetId: asset?._id || null,
        link: asset?.link || '',
        displayName: asset?.name || seg.label,
      };
    }
    return seg;
  });
