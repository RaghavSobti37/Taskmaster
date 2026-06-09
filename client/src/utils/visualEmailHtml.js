import {
  PARAGRAPH_MARGIN,
  HEADING_MARGIN,
  LIST_MARGIN,
  LIST_PADDING_LEFT,
  wrapPreviewDocument,
} from '@shared/emailBlockSpacing.cjs';

/** Quill snow default: 3em per indent level */
export const QUILL_INDENT_STEP_EM = 3;
const INDENT_CLASS_RE = /\bql-indent-(\d+)\b/i;
const INDENT_DRIFT_RE = /ql-indent-\d+|(?:padding-left|margin-left|text-indent)\s*:/i;
const BLOCK_SELECTOR = 'p, div, li, blockquote, h1, h2, h3, h4, h5, h6, ul, ol';

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

const stripQuillClasses = (className = '') => (className || '')
  .split(/\s+/)
  .filter((c) => c && !/^ql-/i.test(c) && c !== 'email-preview-root')
  .join(' ');

const paragraphBase = `margin:${PARAGRAPH_MARGIN};padding-top:0;padding-bottom:0;padding-right:0;margin-left:0;text-indent:0;border:0`;
const headingBase = `margin:${HEADING_MARGIN};padding-top:0;padding-bottom:0;padding-right:0;margin-left:0;text-indent:0;border:0`;
const listBase = `margin:${LIST_MARGIN};padding-top:0;padding-bottom:0;padding-right:0;margin-left:0;padding-left:${LIST_PADDING_LEFT};text-indent:0;border:0`;
const blockBase = 'margin:0;padding-top:0;padding-bottom:0;padding-right:0;margin-left:0;text-indent:0;border:0';

const blockPreset = (tag) => {
  if (tag === 'p' || tag === 'blockquote') return paragraphBase;
  if (/^h[1-6]$/.test(tag)) return headingBase;
  if (tag === 'ul' || tag === 'ol') return listBase;
  return blockBase;
};

const normalizeBlockIndent = (el, { fullParagraphSpacing = true } = {}) => {
  const tag = el.tagName.toLowerCase();
  const classLevel = quillIndentLevelFromClass(el.className || '');
  const existingStyle = el.getAttribute('style') || '';
  const styleLevelEm = Math.max(
    parseAxisEm(existingStyle, 'padding-left'),
    parseAxisEm(existingStyle, 'margin-left'),
    parseAxisEm(existingStyle, 'text-indent'),
  );
  const indentEm = Math.max(classLevel * QUILL_INDENT_STEP_EM, styleLevelEm);

  const cleaned = stripIndentProps(existingStyle);
  let mergedStyle = fullParagraphSpacing ? blockPreset(tag) : blockBase;
  if (cleaned) mergedStyle = `${mergedStyle};${cleaned}`;
  if (indentEm > 0) mergedStyle = `${mergedStyle};padding-left:${indentEm}em!important`;

  el.setAttribute('style', mergedStyle);
  const nextClass = stripQuillClasses(el.className || '');
  if (nextClass) el.setAttribute('class', nextClass);
  else el.removeAttribute('class');
};

/**
 * Fix phantom indent drift (ql-indent classes vs inline padding-left) without touching normal blocks.
 */
export function repairIndentDrift(html) {
  if (!html?.trim() || typeof document === 'undefined') return html || '';
  if (!INDENT_DRIFT_RE.test(html)) return html;

  const wrap = document.createElement('div');
  wrap.innerHTML = html;

  wrap.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
    const classLevel = quillIndentLevelFromClass(el.className || '');
    const existingStyle = el.getAttribute('style') || '';
    const hasIndentStyle = /(?:padding-left|margin-left|text-indent)\s*:/i.test(existingStyle);
    if (!classLevel && !hasIndentStyle) return;
    normalizeBlockIndent(el, { fullParagraphSpacing: false });
  });

  return wrap.innerHTML.trim();
}

/**
 * Canonical visual mail HTML: inline indent only, strip all Quill classes, consistent block spacing.
 */
export function canonicalizeVisualMailHtml(html) {
  if (!html?.trim() || typeof document === 'undefined') return html || '';

  const wrap = document.createElement('div');
  wrap.innerHTML = html;

  wrap.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
    normalizeBlockIndent(el, { fullParagraphSpacing: true });
  });

  return wrap.innerHTML.trim();
}

/** @deprecated Use canonicalizeVisualMailHtml — kept for existing imports */
export function inlineQuillIndentsInHtml(html) {
  return canonicalizeVisualMailHtml(html);
}

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
  const processed = canonicalizeVisualMailHtml(stripHardcodedTextColors(rawBody));
  return wrapVisualPreviewBody(processed, { theme });
}

/** Client preview shell — same spacing as server wrapPreviewDocument and editor CSS */
export function wrapVisualPreviewBody(bodyHtml, options = {}) {
  return wrapPreviewDocument(bodyHtml, options);
}
