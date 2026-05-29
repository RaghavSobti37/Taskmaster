export const UNSUBSCRIBE_START = '<!-- TASKMASTER_UNSUBSCRIBE_START -->';
export const UNSUBSCRIBE_END = '<!-- TASKMASTER_UNSUBSCRIBE_END -->';

export const defaultUnsubscribeBlock = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; font-family: sans-serif;">
  <p style="margin: 4px 0;">You are receiving this email because you opted in at our website or events.</p>
  <p style="margin: 4px 0;">If you no longer wish to receive these emails, you can <a href="{{unsubscribe_url}}" style="color: #ef4444; text-decoration: underline;">unsubscribe here</a>.</p>
</div>`;

export const hasUnsubscribeBlock = (html) =>
  Boolean(html && html.includes(UNSUBSCRIBE_START) && html.includes(UNSUBSCRIBE_END));

export const stripUnsubscribe = (html) => {
  if (!html) return '';
  let result = html.replace(
    new RegExp(`${UNSUBSCRIBE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${UNSUBSCRIBE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    ''
  );
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
    if (k === 'unsubscribe_url') return '#unsubscribe-preview';
    const val = sampleValues[k];
    if (val) return val;
    if (inlineFallback !== undefined && inlineFallback !== '') return inlineFallback;
    return `[${key}]`;
  });
};
