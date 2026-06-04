import DOMPurify from 'dompurify';

/** Match Quill .ql-editor block spacing so iframe preview aligns with the editor. */
const EMAIL_PREVIEW_CSS = `
  body {
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.42;
    word-wrap: break-word;
  }
  .email-preview-root > *:first-child {
    margin-top: 0 !important;
  }
  .email-preview-root p,
  .email-preview-root ol,
  .email-preview-root ul,
  .email-preview-root pre,
  .email-preview-root blockquote,
  .email-preview-root h1,
  .email-preview-root h2,
  .email-preview-root h3 {
    margin: 0 !important;
    padding: 0 !important;
    text-indent: 0 !important;
  }
  .email-preview-root ol,
  .email-preview-root ul {
    padding-left: 1.5em;
  }
  .email-preview-root [class*='ql-indent'] {
    padding-left: 0 !important;
    margin-left: 0 !important;
  }
`;

const stripPreviewIndent = (html) => {
  if (!html || typeof document === 'undefined') return html || '';
  try {
    const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
    const root = doc.getElementById('root');
    if (!root) return html;

    root.querySelectorAll('style').forEach((el) => {
      const text = el.textContent || '';
      if (/\.ql-|ql-indent|quill/i.test(text)) el.remove();
    });

    root.querySelectorAll('[class]').forEach((el) => {
      [...el.classList].forEach((cls) => {
        if (cls.startsWith('ql-indent') || cls === 'ql-editor') el.classList.remove(cls);
      });
    });

    root.querySelectorAll('p, div, span, blockquote, h1, h2, h3, h4, h5, h6').forEach((el) => {
      if (!el.style) return;
      el.style.removeProperty('margin-left');
      el.style.removeProperty('padding-left');
      el.style.removeProperty('text-indent');
    });
    root.querySelectorAll('[data-indent]').forEach((el) => el.removeAttribute('data-indent'));

    return root.innerHTML;
  } catch {
    return html;
  }
};

/**
 * Wrap visual (Quill) HTML for iframe srcDoc — same left edge as editor, no stray indents.
 */
export const buildVisualEmailPreviewDoc = (html, { theme = 'light' } = {}) => {
  const cleaned = stripPreviewIndent(html || '');
  const sanitized = DOMPurify.sanitize(cleaned);
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const color = theme === 'dark' ? '#f8fafc' : '#0f172a';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${EMAIL_PREVIEW_CSS} body{background:${bg};color:${color};}</style></head><body><div class="email-preview-root">${sanitized}</div></body></html>`;
};
