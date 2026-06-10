/**
 * Email block spacing — single source of truth for Template Studio editor,
 * client preview (wrapVisualPreviewBody), and server preview (wrapPreviewDocument).
 * Keep in sync with client/src/utils/emailBlockSpacing.js and .mail-template-quill rules in client/src/index.css.
 */

const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** CSS margin shorthand values (no !important — used in preview/editor CSS) */
const PARAGRAPH_MARGIN = '0 0 1em 0';
const HEADING_MARGIN = '0 0 0.75em 0';
const LIST_MARGIN = '0 0 1em 0';
const LIST_PADDING_LEFT = '1.5em';

/** Inline styles for outbound HTML (normalizeOutboundEmailHtml) */
const PARAGRAPH_INLINE =
  'margin:0 0 1em 0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;margin-left:0!important;text-indent:0!important;border:0!important;border-left:0!important';
const HEADING_INLINE =
  'margin:0 0 0.75em 0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;margin-left:0!important;text-indent:0!important;border:0!important;border-left:0!important';
const LIST_UL_INLINE =
  'margin:0 0 1em 0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;margin-left:0!important;padding-left:1.5em!important';

/** Blank-line spacer — survives email clients (non-collapsing) */
const SPACER_INLINE =
  'margin:0 0 1em 0!important;padding:0!important;margin-left:0!important;text-indent:0!important;border:0!important';

const PREVIEW_BASE_CSS = `
  body{margin:0;padding:16px;font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:1.42;}
  .email-preview-root,.email-preview-root p,.email-preview-root div,.email-preview-root li,.email-preview-root blockquote{max-width:100%;color:inherit;}
  a{color:#2563eb;}
`;

/** Block spacing rules shared by preview iframes and editor WYSIWYG */
const PREVIEW_BLOCK_CSS = `
  p,blockquote{margin:${PARAGRAPH_MARGIN};}
  h1,h2,h3,h4,h5,h6{margin:${HEADING_MARGIN};}
  ul,ol{margin:${LIST_MARGIN};padding-left:${LIST_PADDING_LEFT};}
  li{margin:0;}
`;

/** CSS selector rules for Quill editor — values must match PREVIEW_BLOCK_CSS */
const EDITOR_BLOCK_CSS = `
  .mail-template-quill .ql-editor{font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:1.42;}
  .mail-template-quill .ql-editor p,.mail-template-quill .ql-editor blockquote{margin:${PARAGRAPH_MARGIN};}
  .mail-template-quill .ql-editor h1,.mail-template-quill .ql-editor h2,.mail-template-quill .ql-editor h3,.mail-template-quill .ql-editor h4,.mail-template-quill .ql-editor h5,.mail-template-quill .ql-editor h6{margin:${HEADING_MARGIN};}
  .mail-template-quill .ql-editor ul,.mail-template-quill .ql-editor ol{margin:${LIST_MARGIN};padding-left:${LIST_PADDING_LEFT};}
  .mail-template-quill .ql-editor li{margin:0;}
  .mail-template-quill .ql-editor p:last-child,.mail-template-quill .ql-editor blockquote:last-child,.mail-template-quill .ql-editor ul:last-child,.mail-template-quill .ql-editor ol:last-child{margin-bottom:0;}
`;

function wrapPreviewDocument(bodyHtml, { theme = 'light' } = {}) {
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const color = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const inner = (bodyHtml || '').trim();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    body{background:${bg};color:${color};}
    ${PREVIEW_BASE_CSS}
    ${PREVIEW_BLOCK_CSS}
  </style></head><body>${inner}</body></html>`;
}

module.exports = {
  EMAIL_FONT_STACK,
  PARAGRAPH_MARGIN,
  HEADING_MARGIN,
  LIST_MARGIN,
  LIST_PADDING_LEFT,
  PARAGRAPH_INLINE,
  HEADING_INLINE,
  LIST_UL_INLINE,
  SPACER_INLINE,
  PREVIEW_BASE_CSS,
  PREVIEW_BLOCK_CSS,
  EDITOR_BLOCK_CSS,
  wrapPreviewDocument,
};
