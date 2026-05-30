export const UNSUBSCRIBE_START = '<!-- TASKMASTER_UNSUBSCRIBE_START -->';
export const UNSUBSCRIBE_END = '<!-- TASKMASTER_UNSUBSCRIBE_END -->';

export const defaultUnsubscribeBlock = `<div data-taskmaster-unsubscribe="true" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; font-family: sans-serif;">
  <p style="margin: 4px 0;">You are receiving this email because you opted in at our website or events.</p>
  <p style="margin: 4px 0;">If you no longer wish to receive these emails, you can <a href="{{unsubscribe_url}}" style="color: #ef4444; text-decoration: underline;">unsubscribe here</a>.</p>
</div>`;

const MARKER_BLOCK_RE = new RegExp(
  `${UNSUBSCRIBE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${UNSUBSCRIBE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'gi'
);

const DATA_ATTR_UNSUB_RE = /<div[^>]*data-taskmaster-unsubscribe\s*=\s*["']?true["']?[^>]*>[\s\S]*?<\/div>/gi;

/** Footer blocks Quill may leave after stripping HTML comments */
const LEGACY_UNSUB_RE = /<div[^>]*>[\s\S]*?\{\{unsubscribe_url\}\}[\s\S]*?<\/div>/gi;

export const hasUnsubscribeBlock = (html) => countUnsubscribeBlocks(html) > 0;

export const countUnsubscribeBlocks = (html) => {
  if (!html) return 0;
  const markerCount = (html.match(MARKER_BLOCK_RE) || []).length;
  if (markerCount > 0) return markerCount;
  const dataCount = (html.match(DATA_ATTR_UNSUB_RE) || []).length;
  if (dataCount > 0) return dataCount;
  if (/\{\{unsubscribe_url\}\}/.test(html)) {
    return (html.match(LEGACY_UNSUB_RE) || []).length || 1;
  }
  return 0;
};

export const stripUnsubscribe = (html) => {
  if (!html) return '';
  let result = html.replace(MARKER_BLOCK_RE, '');
  result = result.replace(DATA_ATTR_UNSUB_RE, '');
  result = result.replace(LEGACY_UNSUB_RE, '');
  return result.trimEnd();
};

export const wrapUnsubscribeBlock = (block) => {
  const trimmed = (block || defaultUnsubscribeBlock).trim();
  if (hasUnsubscribeBlock(trimmed)) return trimmed;
  return `${UNSUBSCRIBE_START}\n${trimmed}\n${UNSUBSCRIBE_END}`;
};

export const appendUnsubscribe = (html, block = defaultUnsubscribeBlock) => {
  const wrapped = wrapUnsubscribeBlock(block);
  const base = stripUnsubscribe(html || '');
  if (/<\/body>/i.test(base)) {
    return base.replace(/<\/body>/i, `\n${wrapped}\n</body>`);
  }
  if (/<\/html>/i.test(base)) {
    return base.replace(/<\/html>/i, `\n${wrapped}\n</html>`);
  }
  return base ? `${base}\n${wrapped}` : wrapped;
};

export const syncUnsubscribeInContent = (html, include) => {
  if (!include) return stripUnsubscribe(html);
  return appendUnsubscribe(html);
};

/** Parse {{var}} and {{var|fallback}} — skips unsubscribe_url */
export const parseTemplateVariables = (html) => {
  const regex = /\{\{(\w+)(?:\|([^}]*))?\}\}/g;
  const vars = new Map();
  let match;
  while ((match = regex.exec(html || '')) !== null) {
    const key = match[1].toLowerCase();
    if (key === 'unsubscribe_url') continue;
    vars.set(key, {
      key,
      inlineFallback: match[2] !== undefined ? match[2] : null,
    });
  }
  return Array.from(vars.values());
};

export const insertVariable = (html, varName) => {
  const token = `{{${varName}}}`;
  if ((html || '').includes(token)) return html;
  return `${html || ''}${token}`;
};

export const setVariableFallbackInContent = (html, varName, fallback) => {
  const regex = new RegExp(`\\{\\{${varName}(\\|[^}]*)?\\}\\}`, 'gi');
  return (html || '').replace(regex, `{{${varName}|${fallback}}}`);
};

export const previewMergeTags = (html, sampleValues = { firstname: 'Alex' }) => {
  return (html || '').replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (match, key, inlineFallback) => {
    const k = key.toLowerCase();
    if (k === 'unsubscribe_url') return '/unsubscribe';
    const val = sampleValues[k];
    if (val) return val;
    if (inlineFallback !== undefined && inlineFallback !== '') return inlineFallback;
    return `[${key}]`;
  });
};
