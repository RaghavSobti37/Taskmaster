import {
  PARAGRAPH_MARGIN,
  HEADING_MARGIN,
  LIST_MARGIN,
  LIST_PADDING_LEFT,
  SPACER_INLINE,
  wrapPreviewDocument,
} from './emailBlockSpacing.js';

/** Quill snow default: 3em per indent level */
export const QUILL_INDENT_STEP_EM = 3;
const INDENT_CLASS_RE = /\bql-indent-(\d+)\b/i;
const INDENT_DRIFT_RE = /ql-indent-\d+|(?:padding-left|margin-left|text-indent)\s*:/i;
const BLOCK_SELECTOR = 'p, div, li, blockquote, h1, h2, h3, h4, h5, h6, ul, ol';
const BLOCK_TAGS = new Set(['p', 'div', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
const JUNK_TAG_NAMES = ['meta', 'style', 'script', 'head', 'title', 'link'];

const escapeHtmlText = (text = '') => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const isEmptyParagraphContent = (innerHtml = '') => {
  const plain = (innerHtml || '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .trim();
  return !plain;
};

const isEffectivelyEmpty = (el) => isEmptyParagraphContent(el?.innerHTML ?? '');

const isBlockElement = (el) => el?.nodeType === 1 && BLOCK_TAGS.has(el.tagName.toLowerCase());

const hasListOrTable = (el) => !!el?.querySelector?.('ul, ol, table');

/** Paste must never keep foreign or Quill-inferred indent — toolbar applies indent after paste only. */
const stripForeignBlockAttrs = (el) => {
  if (!el?.removeAttribute) return;
  el.removeAttribute('class');
  el.removeAttribute('dir');
  el.removeAttribute('id');
  el.removeAttribute('role');
  const cleaned = stripIndentProps(el.getAttribute('style') || '');
  if (cleaned) el.setAttribute('style', cleaned);
  else el.removeAttribute('style');
};

const BULLET_LINE_RE = /^[\s]*(?:[•●○▪◦‣⁃\-*–—]|\d+[.)])\s+/;
const BARE_URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const ALLOWED_INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'br']);

const normalizeLineForMatch = (text = '') => text.replace(/\s+/g, ' ').trim();

const isBulletLine = (line = '') => BULLET_LINE_RE.test(String(line).trim());

const stripBulletPrefix = (line = '') => String(line).trim().replace(BULLET_LINE_RE, '');

/** Quill/Gmail invent <ul> for plain lines — flatten unless source lines had real bullet markers. */
const flattenAccidentalLists = (root) => {
  root.querySelectorAll('ul, ol').forEach((list) => {
    const items = [...list.children].filter((n) => n.tagName === 'LI');
    if (!items.length) {
      list.remove();
      return;
    }
    if (items.some((li) => isBulletLine(li.textContent))) return;

    const replacement = document.createDocumentFragment();
    items.forEach((li) => {
      const p = document.createElement('p');
      p.innerHTML = li.innerHTML;
      replacement.appendChild(p);
    });
    list.replaceWith(replacement);
  });
};

const linkifyBareUrlsInElement = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.parentElement?.tagName !== 'A') textNodes.push(node);
    node = walker.nextNode();
  }
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || '';
    if (!BARE_URL_RE.test(text)) return;
    BARE_URL_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match = BARE_URL_RE.exec(text);
    while (match) {
      if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      const a = document.createElement('a');
      a.href = match[1];
      a.textContent = match[1];
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      frag.appendChild(a);
      last = match.index + match[1].length;
      match = BARE_URL_RE.exec(text);
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  });
};

const sanitizeInlineHtml = (innerHtml = '') => {
  const wrap = document.createElement('div');
  wrap.innerHTML = innerHtml || '';
  wrap.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_INLINE_TAGS.has(tag)) {
      el.replaceWith(...el.childNodes);
      return;
    }
    if (tag === 'a') {
      const href = el.getAttribute('href');
      [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
      if (href) {
        el.setAttribute('href', href);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    } else {
      [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
    }
  });
  linkifyBareUrlsInElement(wrap);
  return wrap.innerHTML.trim();
};

const extractFormattedLineMap = (html = '') => {
  const map = new Map();
  const root = document.createElement('div');
  root.innerHTML = html || '';
  removeJunkNodes(root);
  flattenRedundantWrappers(root);

  const register = (inner, text) => {
    const key = normalizeLineForMatch(text);
    if (!key || map.has(key)) return;
    map.set(key, sanitizeInlineHtml(inner));
  };

  root.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote').forEach((block) => {
    const inner = block.innerHTML || '';
    const text = block.textContent || '';
    if (/<br\s*\/?>/i.test(inner)) {
      inner.split(/<br\s*\/?>/i).forEach((part, idx) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = part;
        register(part, tmp.textContent || text.split('\n')[idx] || '');
      });
    } else {
      register(inner, text);
    }
  });

  return map;
};

const formattedLineHtml = (line, formatMap) => {
  const trimmed = String(line).trimEnd();
  const key = normalizeLineForMatch(trimmed);
  if (!key) return '';

  let html = formatMap.get(key);
  if (!html) {
    for (const [mapKey, mapHtml] of formatMap) {
      if (mapKey === key || mapKey.startsWith(key) || key.startsWith(mapKey)) {
        html = mapHtml;
        break;
      }
    }
  }
  if (!html) html = escapeHtmlText(trimmed);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  linkifyBareUrlsInElement(wrap);
  return wrap.innerHTML;
};

/**
 * Visual paste: plain text = notepad structure; HTML clipboard = bold/italic/links only.
 */
export function buildVisualPasteHtml(plainText = '', html = '') {
  if (!plainText?.trim() || typeof document === 'undefined') {
    return sanitizeHtmlOnlyPaste(html);
  }

  const formatMap = extractFormattedLineMap(html);
  const paragraphs = plainText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];

  paragraphs.forEach((para) => {
    const rawLines = para.split('\n').map((l) => l.trimEnd());
    const nonEmpty = rawLines.filter((l) => normalizeLineForMatch(l));

    if (nonEmpty.length > 1 && nonEmpty.every(isBulletLine)) {
      const ul = document.createElement('ul');
      nonEmpty.forEach((line) => {
        const li = document.createElement('li');
        li.innerHTML = formattedLineHtml(stripBulletPrefix(line), formatMap);
        ul.appendChild(li);
      });
      chunks.push(ul.outerHTML);
      return;
    }

    const parts = rawLines
      .map((line) => (normalizeLineForMatch(line) ? formattedLineHtml(line, formatMap) : ''))
      .filter((part, idx, arr) => part || (idx > 0 && idx < arr.length - 1));
    if (!parts.length) return;

    const p = document.createElement('p');
    p.innerHTML = parts.join('<br>');
    chunks.push(p.outerHTML);
  });

  const root = document.createElement('div');
  root.innerHTML = chunks.join('');
  root.querySelectorAll(BLOCK_SELECTOR).forEach(stripForeignBlockAttrs);
  stripTabChars(root);
  return root.innerHTML.trim();
};

const sanitizeHtmlOnlyPaste = (html = '') => {
  if (!html?.trim() || typeof document === 'undefined') return html || '';
  const root = document.createElement('div');
  root.innerHTML = html;
  removeJunkNodes(root);
  flattenRedundantWrappers(root);
  flattenAccidentalLists(root);
  convertBlockquotesToParagraphs(root);
  unwrapDecorativeSpans(root);
  convertTextDivsToParagraphs(root);
  root.querySelectorAll(BLOCK_SELECTOR).forEach(stripForeignBlockAttrs);
  collapseSandwichedEmptyBlocks(root);
  stripTabChars(root);
  return root.innerHTML.trim();
};

const buildHtmlFromPlainTextPaste = (plain = '') => {
  const text = plain.replace(/\r\n/g, '\n');
  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return '';
  return paragraphs.map((para) => {
    const lines = para.split('\n').map((l) => l.trimEnd());
    const inner = lines.map((l) => escapeHtmlText(l)).join('<br>');
    return `<p>${inner || '&nbsp;'}</p>`;
  }).join('');
};

const flattenRedundantWrappers = (root) => {
  let changed = true;
  while (changed) {
    changed = false;
    root.querySelectorAll('div').forEach((div) => {
      if (hasListOrTable(div)) return;
      if (div.getAttribute('style') || div.className || div.id) return;
      const children = [...div.childNodes];
      if (children.length === 0) return;
      const onlyBlocks = children.every(
        (n) => n.nodeType === 3 && !n.textContent.trim()
          || (n.nodeType === 1 && isBlockElement(n)),
      );
      if (!onlyBlocks) return;
      const parent = div.parentNode;
      if (!parent) return;
      while (div.firstChild) parent.insertBefore(div.firstChild, div);
      div.remove();
      changed = true;
    });
  }
};

const convertBlockquotesToParagraphs = (root) => {
  root.querySelectorAll('blockquote').forEach((bq) => {
    const p = document.createElement('p');
    p.innerHTML = bq.innerHTML;
    bq.replaceWith(p);
  });
};

const convertTextDivsToParagraphs = (root) => {
  root.querySelectorAll('div').forEach((div) => {
    if (hasListOrTable(div)) return;
    const p = document.createElement('p');
    while (div.firstChild) p.appendChild(div.firstChild);
    div.replaceWith(p);
  });
};

const unwrapDecorativeSpans = (root) => {
  root.querySelectorAll('span').forEach((span) => {
    if (span.querySelector('a, ul, ol, table, img')) return;
    const style = span.getAttribute('style') || '';
    const keepsFormat = /font-weight|font-style|text-decoration|vertical-align/i.test(style);
    if (keepsFormat || span.className) return;
    span.replaceWith(...span.childNodes);
  });
};

const removeJunkNodes = (root) => {
  JUNK_TAG_NAMES.forEach((tag) => {
    root.querySelectorAll(tag).forEach((el) => el.remove());
  });
  root.querySelectorAll('*').forEach((el) => {
    if (el.tagName?.toLowerCase() === 'o:p') el.remove();
  });
};

const collapseSandwichedEmptyBlocks = (parent) => {
  const blocks = [...parent.children].filter(isBlockElement);
  blocks.forEach((block, i) => {
    if (!isEffectivelyEmpty(block)) return;
    const prev = blocks[i - 1];
    const next = blocks[i + 1];
    if (prev && next && !isEffectivelyEmpty(prev) && !isEffectivelyEmpty(next)) {
      block.remove();
    }
  });

  const remaining = [...parent.children].filter(isBlockElement);
  remaining.forEach((block, i) => {
    if (!isEffectivelyEmpty(block)) return;
    const prev = remaining[i - 1];
    if (prev && isEffectivelyEmpty(prev)) block.remove();
  });

  [...parent.children].filter((el) => el.tagName?.toLowerCase() === 'div' || el.tagName?.toLowerCase() === 'p')
    .forEach((child) => {
      if (!isEffectivelyEmpty(child) && !hasListOrTable(child)) collapseSandwichedEmptyBlocks(child);
    });
};

const normalizePlainTextPasteStructure = (root) => {
  const text = (root.textContent || root.innerText || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return false;
  const hasRichStructure = root.querySelector(
    'p, div, li, h1, h2, h3, h4, h5, h6, table, img, a, ul, ol, blockquote',
  );
  if (hasRichStructure) return false;

  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return false;

  root.innerHTML = paragraphs.map((para) => {
    const lines = para.split('\n').map((l) => l.trimEnd());
    const inner = lines.map((l) => escapeHtmlText(l)).join('<br>');
    return `<p>${inner || '&nbsp;'}</p>`;
  }).join('');
  return true;
};

const stripTabChars = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent.includes('\t')) {
      node.textContent = node.textContent.replace(/\t/g, '');
    }
    node = walker.nextNode();
  }
};

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

const convertEmptyParagraphsToSpacers = (root) => {
  root.querySelectorAll('p, div').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'p' && tag !== 'div') return;
    if (!isEmptyParagraphContent(el.innerHTML)) return;
    el.innerHTML = '&nbsp;';
    el.setAttribute('style', SPACER_INLINE);
    el.removeAttribute('class');
  });
};

const normalizeBlockIndent = (el, { fullParagraphSpacing = true } = {}) => {
  const tag = el.tagName.toLowerCase();
  const existingStyle = el.getAttribute('style') || '';
  const cleaned = stripIndentProps(existingStyle);

  // List items inherit offset from <ul>/<ol> — never stack toolbar indent on <li> (paste bug source).
  if (tag === 'li') {
    if (cleaned) el.setAttribute('style', cleaned);
    else el.removeAttribute('style');
    el.removeAttribute('class');
    return;
  }

  const classLevel = quillIndentLevelFromClass(el.className || '');
  const styleLevelEm = Math.max(
    parseAxisEm(existingStyle, 'padding-left'),
    parseAxisEm(existingStyle, 'margin-left'),
    parseAxisEm(existingStyle, 'text-indent'),
  );
  const indentEm = Math.max(classLevel * QUILL_INDENT_STEP_EM, styleLevelEm);

  let mergedStyle = fullParagraphSpacing ? blockPreset(tag) : blockBase;
  if (cleaned) mergedStyle = `${mergedStyle};${cleaned}`;
  if (indentEm > 0) mergedStyle = `${mergedStyle};padding-left:${indentEm}em!important`;

  el.setAttribute('style', mergedStyle);
  const nextClass = stripQuillClasses(el.className || '');
  if (nextClass) el.setAttribute('class', nextClass);
  else el.removeAttribute('class');
};

/**
 * Normalize clipboard HTML before Quill ingests it — strip foreign indent, Gmail/Word wrappers,
 * phantom empty blocks, and map plain-text newlines to our Enter/Shift+Enter model.
 */
export function sanitizePastedVisualMailHtml(html, { plainText = '' } = {}) {
  if (typeof document === 'undefined') return html || plainText || '';
  const plain = (plainText || '').trim()
    || (!/<[a-z][^>]*>/i.test(html || '') ? String(html || '').trim() : '');
  if (plain) return buildVisualPasteHtml(plain, html);
  return sanitizeHtmlOnlyPaste(html);
}

/** DOM root variant (Quill clipboard container). */
export function sanitizePastedDomRoot(root) {
  if (!root || typeof document === 'undefined') return;
  const cleaned = sanitizePastedVisualMailHtml(root.innerHTML);
  root.innerHTML = cleaned;
}

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

  flattenAccidentalLists(wrap);
  convertEmptyParagraphsToSpacers(wrap);

  wrap.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (style === SPACER_INLINE || (el.innerHTML === '&nbsp;' && /margin:0 0 1em 0!important/i.test(style))) {
      return;
    }
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

/** Re-apply indent inlines on a full preview document from the Auto-Mailer preview pipeline. */
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
