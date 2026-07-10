import { uploadFiles } from './uploadthing';

export const MAIL_TEMPLATE_IMAGE_UPLOADER = 'mailTemplateImageUploader';

export const buildInlineImageTag = (url, alt = '') => {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return '';
  const safeAlt = String(alt || '').replace(/"/g, '&quot;');
  return `<img src="${safeUrl}" alt="${safeAlt}" style="display:block;max-width:100%;height:auto;border:0;" />`;
};

export const insertHtmlAtTextareaCursor = (textarea, html) => {
  if (!textarea || !html) return '';
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const next = `${before}${html}${after}`;
  textarea.value = next;
  const cursor = start + html.length;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
  textarea.focus();
  return next;
};

export const insertImageInQuill = (quill, url) => {
  if (!quill || !url) return;
  const range = quill.getSelection(true);
  const index = range?.index ?? quill.getLength();
  quill.insertEmbed(index, 'image', url, 'user');
  quill.setSelection(index + 1, 0, 'user');
};

export const uploadMailTemplateImage = async (file) => {
  if (!file) throw new Error('No image selected');
  const uploadRes = await uploadFiles(MAIL_TEMPLATE_IMAGE_UPLOADER, { files: [file] });
  const uploaded = uploadRes?.[0];
  const url = uploaded?.url || uploaded?.ufsUrl;
  if (!url) throw new Error('Image upload failed');
  return {
    url,
    name: uploaded?.name || file.name,
    uploadedAt: new Date().toISOString(),
  };
};
