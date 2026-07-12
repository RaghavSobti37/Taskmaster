const cheerio = require('cheerio');
const {
  PARAGRAPH_INLINE,
  HEADING_INLINE,
  LIST_UL_INLINE,
  SPACER_INLINE,
} = require('../../shared/emailBlockSpacing.cjs');

const INDENT_STYLE_PROP = /^(padding-left|margin-left|text-indent|border-left|border-left-width|border-left-style)\s*:/i;
const SHORTHAND_INDENT_PROP = /^(margin|padding)\s*:/i;
const QUILL_STYLE_RE = /\.ql-|ql-indent|quill/i;
const LIST_TAGS = new Set(['ul', 'ol']);
const BLOCK_TAGS = new Set(['p', 'div', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'table', 'span', 'a']);
const FLUSH_INLINE = 'margin:0!important;padding:0!important;padding-left:0!important;margin-left:0!important;text-indent:0!important;border:0!important;border-left:0!important';

/** Quill snow default: each indent level = 3em */
const QUILL_INDENT_STEP_EM = 3;

const blockPreset = (tag) => {
  if (LIST_TAGS.has(tag)) return LIST_UL_INLINE;
  if (tag === 'p' || tag === 'blockquote') return PARAGRAPH_INLINE;
  if (/^h[1-6]$/.test(tag)) return HEADING_INLINE;
  return FLUSH_INLINE;
};

const hasLeftIndentInShorthand = (value) => {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  const parts = v.split(/\s+/);
  if (parts.length === 4) return parseFloat(parts[3]) > 0;
  if (parts.length === 3) return parseFloat(parts[2]) > 0;
  if (parts.length === 2) return parseFloat(parts[1]) > 0;
  return false;
};

const cleanIndentFromStyle = (style) => {
  if (!style) return '';
  return style
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (INDENT_STYLE_PROP.test(part)) return false;
      if (SHORTHAND_INDENT_PROP.test(part) && hasLeftIndentInShorthand(part.split(':').slice(1).join(':'))) {
        return false;
      }
      return true;
    })
    .join('; ');
};

const parseAxisEm = (style, prop) => {
  const re = new RegExp(`${prop}\\s*:\\s*([^;!]+)`, 'i');
  const m = re.exec(style || '');
  if (!m) return 0;
  const v = m[1].trim().toLowerCase();
  const num = parseFloat(v);
  if (Number.isNaN(num)) return 0;
  if (v.endsWith('em') || v.endsWith('rem')) return num;
  if (v.endsWith('px')) return num / 16;
  if (v.endsWith('pt')) return num / 12;
  return num / 16;
};

const quillIndentLevel = (classAttr = '') => {
  let level = 0;
  for (const c of classAttr.split(/\s+/)) {
    const m = /^ql-indent-(\d+)$/i.exec(c);
    if (m) level = Math.max(level, parseInt(m[1], 10));
  }
  return level;
};

const resolveIndentEm = (classAttr = '', style = '') => {
  const classEm = quillIndentLevel(classAttr) * QUILL_INDENT_STEP_EM;
  const padEm = parseAxisEm(style, 'padding-left');
  const marginEm = parseAxisEm(style, 'margin-left');
  const textEm = parseAxisEm(style, 'text-indent');
  return Math.max(classEm, padEm, marginEm, textEm);
};

const indentPaddingDeclaration = (classAttr = '', style = '') => {
  const em = resolveIndentEm(classAttr, style);
  if (em <= 0) return '';
  return `padding-left:${em}em!important`;
};

const composeBlockStyle = (tag, classAttr = '', userStyle = '') => {
  const indentPad = indentPaddingDeclaration(classAttr, userStyle);
  const cleaned = cleanIndentFromStyle(userStyle);
  let style = blockPreset(tag);
  if (cleaned) style = `${style};${cleaned}`;
  if (indentPad) style = `${style};${indentPad}`;
  return style;
};

const isEmptyParagraph = ($, el) => {
  const tag = (el.tagName || '').toLowerCase();
  if (tag !== 'p' && tag !== 'div') return false;
  const inner = $(el).html() || '';
  const plain = inner
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .trim();
  return !plain;
};

const extractBodyInner = (html) => {
  if (!/<html[\s>]/i.test(html) && !/<body[\s>]/i.test(html)) return html;
  const $doc = cheerio.load(html, { decodeEntities: false });
  const body = $doc('body').html();
  return body != null ? body : html;
};

const isFullHtmlDocument = (html) => /<!DOCTYPE|<html[\s>]/i.test((html || '').trim());

/**
 * Normalize Quill visual HTML for email clients: inline paragraph spacing, preserve indent levels.
 */
const normalizeOutboundEmailHtml = (html) => {
  if (!html || typeof html !== 'string') return html || '';
  if (isFullHtmlDocument(html)) return html.trim();
  let input = extractBodyInner(html);
  if (!/<[a-z][\s\S]*>/i.test(input)) return input;

  const $ = cheerio.load(
    `<div id="ck-email-root">${input}</div>`,
    { decodeEntities: false },
    false
  );

  $('style').each((_, el) => {
    const text = $(el).html() || '';
    if (QUILL_STYLE_RE.test(text)) $(el).remove();
  });

  $('#ck-email-root').find('blockquote').each((_, el) => {
    const inner = $(el).html() || '';
    const classAttr = el.attribs?.class || '';
    const userStyle = el.attribs?.style || '';
    $(el).replaceWith(`<p style="${composeBlockStyle('blockquote', classAttr, userStyle)}">${inner}</p>`);
  });

  $('#ck-email-root').find('p, div').each((_, el) => {
    if (!isEmptyParagraph($, el)) return;
    const $el = $(el);
    $el.html('&nbsp;');
    $el.attr('style', SPACER_INLINE);
    $el.removeAttr('class');
  });

  $('#ck-email-root').find('*').each((_, el) => {
    const tag = (el.tagName || '').toLowerCase();
    const $el = $(el);
    const classAttr = el.attribs?.class || '';
    const userStyle = el.attribs?.style || '';

    if (el.attribs?.class) {
      const classes = classAttr
        .split(/\s+/)
        .filter((c) => c && !/^ql-/i.test(c) && c !== 'email-preview-root');
      if (classes.length) $el.attr('class', classes.join(' '));
      else $el.removeAttr('class');
    }

    $el.removeAttr('data-indent');

    if (BLOCK_TAGS.has(tag)) {
      const inner = ($el.html() || '').trim();
      if ((tag === 'p' || tag === 'div') && inner === '&nbsp;' && (el.attribs?.style || '') === SPACER_INLINE) {
        return;
      }
      $el.attr('style', composeBlockStyle(tag, classAttr, userStyle));
    }
  });

  const unwrapClasses = ['ql-editor', 'ql-container', 'ql-snow', 'email-preview-root'];
  let changed = true;
  while (changed) {
    changed = false;
    $('#ck-email-root').children().each((_, el) => {
      const tag = (el.tagName || '').toLowerCase();
      if (tag !== 'div') return;
      const cls = el.attribs?.class || '';
      const onlyWrapper = !cls || unwrapClasses.some((c) => cls.includes(c));
      const $el = $(el);
      if (onlyWrapper && $el.children().length > 0) {
        $el.replaceWith($el.html() || '');
        changed = true;
      }
    });
  }

  let out = $('#ck-email-root').html() || '';
  out = out
    .replace(/\sstyle="\s*"/gi, '')
    .replace(/\sclass="\s*"/gi, '');

  return out.trim();
};

/** Outer shell ΓÇö same reset preview iframe uses, inlined for Gmail. */
const wrapEmailShell = (bodyHtml) => {
  const inner = (bodyHtml || '').trim();
  if (!inner) return inner;
  return `<div class="email-preview-root" style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.42;word-wrap:break-word;">${inner}</div>`;
};

module.exports = {
  normalizeOutboundEmailHtml,
  wrapEmailShell,
  FLUSH_INLINE,
  PARAGRAPH_INLINE,
  isFullHtmlDocument,
  QUILL_INDENT_STEP_EM,
  resolveIndentEm,
};
