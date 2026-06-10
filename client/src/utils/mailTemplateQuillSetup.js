/**
 * Mail Template Studio — Quill setup: inline indent, swapped Enter/Shift+Enter, hard breaks.
 */
import { Quill } from 'react-quill';
import { buildVisualPasteHtml, sanitizePastedVisualMailHtml } from './visualEmailHtml';

const INDENT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];
const INDENT_STEP_EM = 3;

let registered = false;

const insertNewParagraph = function insertNewParagraph(range, context) {
  if (range.length > 0) {
    this.quill.scroll.deleteAt(range.index, range.length);
  }
  const Parchment = Quill.import('parchment');
  const lineFormats = Object.keys(context.format).reduce((formats, name) => {
    if (Parchment.query(name, Parchment.Scope.BLOCK) && !Array.isArray(context.format[name])) {
      formats[name] = context.format[name];
    }
    return formats;
  }, {});
  this.quill.insertText(range.index, '\n', lineFormats, Quill.sources.USER);
  this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
  this.quill.focus();
  Object.keys(context.format).forEach((name) => {
    if (lineFormats[name] != null) return;
    if (Array.isArray(context.format[name])) return;
    if (name === 'link') return;
    this.quill.format(name, context.format[name], Quill.sources.USER);
  });
  return false;
};

/** Enter = tight line (<br>); Shift+Enter = new paragraph (email block spacing). */
export const MAIL_TEMPLATE_QUILL_KEYBOARD = {
  bindings: {
    'mail-enter-line': {
      key: 'Enter',
      shiftKey: false,
      handler(range) {
        this.quill.insertEmbed(range.index, 'break', true, Quill.sources.USER);
        this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
        return false;
      },
    },
    'mail-shift-paragraph': {
      key: 'Enter',
      shiftKey: true,
      handler: insertNewParagraph,
    },
  },
};

export function registerMailTemplateQuillIndent() {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  try {
    const parchment = Quill.import('parchment');

    class MailHardBreak extends parchment.Embed {
      static create() {
        return document.createElement('br');
      }
    }
    MailHardBreak.blotName = 'break';
    MailHardBreak.tagName = 'BR';
    Quill.register(MailHardBreak);

    const BaseIndent = Quill.import('formats/indent');

    const stripIndentClasses = (node) => {
      if (!node?.classList) return;
      [...node.classList].forEach((c) => {
        if (/^ql-indent-\d+$/i.test(c)) node.classList.remove(c);
      });
    };

    class EmailIndentAttributor extends parchment.StyleAttributor {
      add(node, value) {
        stripIndentClasses(node);
        const raw = String(value || '').trim().toLowerCase();
        let em = 0;
        if (raw.endsWith('em')) {
          em = parseFloat(raw);
        } else {
          const level = parseInt(value, 10);
          if (level > 0) em = level * INDENT_STEP_EM;
        }
        if (!em || em <= 0) {
          this.remove(node);
          return true;
        }
        return super.add(node, `${em}em`);
      }

      value(node) {
        const raw = super.value(node);
        if (!raw) return '';
        const num = parseFloat(raw);
        if (Number.isNaN(num)) return '';
        let em = 0;
        if (String(raw).toLowerCase().endsWith('em')) {
          em = num;
        } else if (String(raw).toLowerCase().endsWith('px')) {
          em = num / 16;
        }
        if (em <= 0) return '';
        const snapped = Math.round(em / INDENT_STEP_EM) * INDENT_STEP_EM;
        return snapped > 0 ? `${snapped}em` : '';
      }
    }

    const indentStyle = new EmailIndentAttributor('indent', 'padding-left', {
      scope: parchment.Scope.BLOCK,
      whitelist: INDENT_LEVELS.map((n) => `${n * INDENT_STEP_EM}em`),
    });

    if (BaseIndent) {
      Quill.register({ 'formats/indent': indentStyle }, true);
    } else {
      Quill.register(indentStyle, true);
    }
  } catch (err) {
    console.warn('[MailTemplateStudio] Quill indent registration skipped', err);
  }
}

registerMailTemplateQuillIndent();

const stripIndentFromDelta = (delta) => {
  if (!delta?.ops?.length) return delta;
  try {
    const Delta = Quill.import('delta');
    return delta.reduce((next, op) => {
      if (!op.attributes?.indent) return next.push(op);
      const { indent, ...rest } = op.attributes;
      return Object.keys(rest).length
        ? next.insert(op.insert, rest)
        : next.insert(op.insert);
    }, new Delta());
  } catch {
    return delta;
  }
};

const stripPasteIndentFromEditor = (root) => {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('p, div, li, blockquote, h1, h2, h3, h4, h5, h6').forEach((el) => {
    [...el.classList].forEach((c) => {
      if (/^ql-indent-\d+$/i.test(c)) el.classList.remove(c);
    });
    const style = el.getAttribute('style') || '';
    const cleaned = style
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p && !/^(padding-left|margin-left|text-indent)\s*:/i.test(p))
      .join('; ');
    if (cleaned) el.setAttribute('style', cleaned);
    else el.removeAttribute('style');
  });
};

/** Strip foreign paste indent/spacing before Quill clipboard convert. */
export function attachMailTemplateClipboardSanitizer(quill) {
  if (!quill || quill.__mailClipboardPatched) return;
  const clipboard = quill.getModule('clipboard');
  if (!clipboard?.convert) return;

  quill.__mailClipboardPatched = true;
  const originalConvert = clipboard.convert.bind(clipboard);

  quill.root.addEventListener('paste', (e) => {
    const plainText = e.clipboardData?.getData('text/plain') || '';
    const html = e.clipboardData?.getData('text/html') || '';
    if (!plainText.trim()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const normalized = buildVisualPasteHtml(plainText, html);
    const range = quill.getSelection(true);
    if (range.length > 0) {
      quill.deleteText(range.index, range.length, Quill.sources.USER);
    }
    quill.clipboard.dangerouslyPasteHTML(range.index, normalized, Quill.sources.USER);
    setTimeout(() => stripPasteIndentFromEditor(quill.root), 3);
  }, true);

  clipboard.convert = function mailTemplateConvert(html) {
    if (typeof html === 'string') {
      return stripIndentFromDelta(originalConvert(sanitizePastedVisualMailHtml(html)));
    }
    return stripIndentFromDelta(originalConvert());
  };
}
