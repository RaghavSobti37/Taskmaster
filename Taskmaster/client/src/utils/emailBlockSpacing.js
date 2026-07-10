/** Client ESM mirror of shared/emailBlockSpacing.cjs — keep in sync */

export const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const PARAGRAPH_MARGIN = '0 0 1em 0';
export const HEADING_MARGIN = '0 0 0.75em 0';
export const LIST_MARGIN = '0 0 1em 0';
export const LIST_PADDING_LEFT = '1.5em';

export const PARAGRAPH_INLINE =
  'margin:0 0 1em 0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;margin-left:0!important;text-indent:0!important;border:0!important;border-left:0!important';
export const HEADING_INLINE =
  'margin:0 0 0.75em 0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;margin-left:0!important;text-indent:0!important;border:0!important;border-left:0!important';
export const LIST_UL_INLINE =
  'margin:0 0 1em 0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;margin-left:0!important;padding-left:1.5em!important';

export const SPACER_INLINE =
  'margin:0 0 1em 0!important;padding:0!important;margin-left:0!important;text-indent:0!important;border:0!important';

/** Padding inside preview iframes (desktop + mobile mocks) */
export const PREVIEW_BODY_PADDING = '20px 32px';

export const PREVIEW_BASE_CSS = `
  body{margin:0;padding:${PREVIEW_BODY_PADDING};font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:1.42;box-sizing:border-box;overflow-wrap:break-word;word-break:break-word;}
  body *,body a,body p,body li,body td{max-width:100%;overflow-wrap:break-word;word-break:break-word;}
  table{max-width:100%!important;}
  .email-preview-root,.email-preview-root p,.email-preview-root div,.email-preview-root li,.email-preview-root blockquote{max-width:100%;color:inherit;}
  a{color:#2563eb;}
`;

export const PREVIEW_BLOCK_CSS = `
  p,blockquote{margin:${PARAGRAPH_MARGIN};}
  h1,h2,h3,h4,h5,h6{margin:${HEADING_MARGIN};}
  ul,ol{margin:${LIST_MARGIN};padding-left:${LIST_PADDING_LEFT};}
  li{margin:0;}
`;

export const EDITOR_BLOCK_CSS = `
  .mail-template-quill .ql-editor{font-family:${EMAIL_FONT_STACK};font-size:14px;line-height:1.42;}
  .mail-template-quill .ql-editor p,.mail-template-quill .ql-editor blockquote{margin:${PARAGRAPH_MARGIN};}
  .mail-template-quill .ql-editor h1,.mail-template-quill .ql-editor h2,.mail-template-quill .ql-editor h3,.mail-template-quill .ql-editor h4,.mail-template-quill .ql-editor h5,.mail-template-quill .ql-editor h6{margin:${HEADING_MARGIN};}
  .mail-template-quill .ql-editor ul,.mail-template-quill .ql-editor ol{margin:${LIST_MARGIN};padding-left:${LIST_PADDING_LEFT};}
  .mail-template-quill .ql-editor li{margin:0;}
  .mail-template-quill .ql-editor p:last-child,.mail-template-quill .ql-editor blockquote:last-child,.mail-template-quill .ql-editor ul:last-child,.mail-template-quill .ql-editor ol:last-child{margin-bottom:0;}
`;

export function wrapPreviewDocument(bodyHtml, { theme = 'light' } = {}) {
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const color = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const inner = (bodyHtml || '').trim();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    body{background:${bg};color:${color};}
    ${PREVIEW_BASE_CSS}
    ${PREVIEW_BLOCK_CSS}
  </style></head><body>${inner}</body></html>`;
}
