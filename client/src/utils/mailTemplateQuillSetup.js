/**
 * Mail Template Studio — Quill indent as inline padding-left (email-safe).
 * Quill 2 may not emit ql-indent-* classes; padding-left syncs editor → preview → send.
 */
import { Quill } from 'react-quill';

const INDENT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];
const INDENT_STEP_EM = 3;

let registered = false;

export function registerMailTemplateQuillIndent() {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  try {
    const parchment = Quill.import('parchment');
    const BaseIndent = Quill.import('formats/indent');

    class EmailIndentAttributor extends parchment.StyleAttributor {
      add(node, value) {
        const level = parseInt(value, 10);
        if (!level || level <= 0) {
          this.remove(node);
          return true;
        }
        return super.add(node, `${level * INDENT_STEP_EM}em`);
      }

      value(node) {
        const raw = super.value(node);
        if (!raw) return '';
        const num = parseFloat(raw);
        if (Number.isNaN(num)) return '';
        if (String(raw).toLowerCase().endsWith('em')) {
          const level = Math.round(num / INDENT_STEP_EM);
          return level > 0 ? String(level) : '';
        }
        if (String(raw).toLowerCase().endsWith('px')) {
          const level = Math.round(num / (INDENT_STEP_EM * 16));
          return level > 0 ? String(level) : '';
        }
        return '';
      }
    }

    // Quill toolbar passes indent LEVEL (1, 2, 3…) — not em values
    const indentStyle = new EmailIndentAttributor('indent', 'padding-left', {
      scope: parchment.Scope.BLOCK,
      whitelist: INDENT_LEVELS.map(String),
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
