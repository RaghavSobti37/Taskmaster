/**
 * Same-origin preview URL for finance files (proxies utfs.io so iframe embed works).
 */
function guessMimeFromFileName(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (/\.(png|jpe?g|webp|gif)$/.test(name)) return 'image/*';
  return '';
}

export function financeFilePreviewUrl(doc) {
  if (!doc) return '';
  if (doc._id) return `/api/finance/${doc._id}/file`;
  if (doc.fileUrl) {
    const params = new URLSearchParams({ url: doc.fileUrl });
    if (doc.fileKey) params.set('key', doc.fileKey);
    const type = doc.fileType || guessMimeFromFileName(doc.fileName);
    if (type) params.set('type', type);
    if (doc.fileName) params.set('name', doc.fileName);
    return `/api/finance/file-proxy?${params.toString()}`;
  }
  return '';
}

export function isFinancePdf(doc) {
  if (!doc) return false;
  return doc.fileType?.includes('pdf') || /\.pdf$/i.test(doc.fileName || '');
}

export function isFinanceImage(doc) {
  if (!doc) return false;
  return doc.fileType?.includes('image') || /\.(png|jpe?g|webp)$/i.test(doc.fileName || '');
}
