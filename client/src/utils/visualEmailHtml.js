/** Quill snow default: 3em per indent level */
export const QUILL_INDENT_STEP_EM = 3;

const INDENT_CLASS_RE = /\bql-indent-(\d+)\b/i;

export const quillIndentLevelFromClass = (className = '') => {
  let level = 0;
  for (const part of className.split(/\s+/)) {
    const m = INDENT_CLASS_RE.exec(part);
    if (m) level = Math.max(level, parseInt(m[1], 10));
  }
  return level;
};

const parseAxisEm = (style = '', prop = 'padding-left') => {
  const re = new RegExp(`${prop}\\s*:\\s*([^;!]+)`, 'i');
  const m = re.exec(style);
  if (!m) return 0;
  const v = m[1].trim().toLowerCase();
  const num = parseFloat(v);
  if (Number.isNaN(num)) return 0;
  if (v.endsWith('em') || v.endsWith('rem')) return num;
  if (v.endsWith('px')) return num / 16;
  if (v.endsWith('pt')) return num / 12;
  return num / 16;
};

const stripIndentProps = (style = '') => style
  .split(';')
  .map((p) => p.trim())
  .filter((p) => p && !/^(padding-left|margin-left|text-indent)\s*:/i.test(p))
  .join('; ');

const paragraphBase = 'margin:0 0 1em 0;padding-top:0;padding-bottom:0;padding-right:0;margin-left:0;text-indent:0;border:0';

/**
 * Inline Quill indent classes + paragraph spacing for email preview (browser).
 */
export function inlineQuillIndentsInHtml(html) {
  if (!html?.trim() || typeof document === 'undefined') return html || '';

  const wrap = document.createElement('div');
  wrap.innerHTML = html;

  wrap.querySelectorAll('p, div, li, blockquote').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const classLevel = quillIndentLevelFromClass(el.className || '');
    const existingStyle = el.getAttribute('style') || '';
    const styleLevelEm = Math.max(
      parseAxisEm(existingStyle, 'padding-left'),
      parseAxisEm(existingStyle, 'margin-left'),
      parseAxisEm(existingStyle, 'text-indent'),
    );
    const classEm = classLevel * QUILL_INDENT_STEP_EM;
    const indentEm = Math.max(classEm, styleLevelEm);

    const cleaned = stripIndentProps(existingStyle);
    let mergedStyle = tag === 'p' || tag === 'blockquote' ? paragraphBase : 'margin:0;padding-top:0;padding-bottom:0;padding-right:0;margin-left:0;text-indent:0;border:0';
    if (cleaned) mergedStyle = `${mergedStyle};${cleaned}`;
    if (indentEm > 0) mergedStyle = `${mergedStyle};padding-left:${indentEm}em!important`;
    el.setAttribute('style', mergedStyle);

    el.className = (el.className || '')
      .split(/\s+/)
      .filter((c) => c && !/^ql-(?!indent-\d+$)/i.test(c) && c !== 'email-preview-root')
      .join(' ');
    if (!el.className) el.removeAttribute('class');
  });

  return wrap.innerHTML.trim();
}

export const QUILL_INDENT_PREVIEW_CSS = `
.ql-indent-1:not(li){padding-left:3em!important;}
.ql-indent-2:not(li){padding-left:6em!important;}
.ql-indent-3:not(li){padding-left:9em!important;}
.ql-indent-4:not(li){padding-left:12em!important;}
.ql-indent-5:not(li){padding-left:15em!important;}
.ql-indent-6:not(li){padding-left:18em!important;}
.ql-indent-7:not(li){padding-left:21em!important;}
.ql-indent-8:not(li){padding-left:24em!important;}
li.ql-indent-1{padding-left:3em!important;}
li.ql-indent-2{padding-left:6em!important;}
li.ql-indent-3{padding-left:9em!important;}
p,blockquote{margin:0 0 1em 0;}
`;

/** Strip hardcoded text colors from server shell so preview theme controls readability. */
function stripHardcodedTextColors(html) {
  if (!html?.trim() || typeof document === 'undefined') return html;
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('[style]').forEach((el) => {
    const next = (el.getAttribute('style') || '')
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p && !/^color\s*:/i.test(p))
      .join('; ');
    if (next) el.setAttribute('style', next);
    else el.removeAttribute('style');
  });
  return root.innerHTML.trim();
}

/** Re-apply indent inlines on a full preview document from /api/mail/preview. */
export function enhancePreviewDocument(fullDoc, { theme = 'light' } = {}) {
  if (!fullDoc?.trim()) return '';
  const bodyMatch = fullDoc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1] : fullDoc;
  const processed = inlineQuillIndentsInHtml(stripHardcodedTextColors(rawBody));
  return wrapVisualPreviewBody(processed, { theme });
}

const PREVIEW_BASE_CSS = `
  body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.42;}
  .email-preview-root, .email-preview-root p, .email-preview-root div, .email-preview-root li, .email-preview-root blockquote {
    max-width:100%;
    color:inherit;
  }
  a { color:#2563eb; }
`;

export function wrapVisualPreviewBody(bodyHtml, { theme = 'light' } = {}) {
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const color = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const inner = (bodyHtml || '').trim();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    body{background:${bg};color:${color};}
    ${PREVIEW_BASE_CSS}
    ${QUILL_INDENT_PREVIEW_CSS}
  </style></head><body>${inner}</body></html>`;
}
