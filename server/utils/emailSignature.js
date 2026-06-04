const appendSignatureIfMissing = (html, signature) => {
  if (!signature || !String(signature).trim()) return html || '';
  const content = html || '';
  if (content.includes(signature)) return content;
  const sep = '<div style="margin:16px 0 0 0;padding:0;line-height:0;font-size:0;height:0;"></div>';
  return content ? `${content}${sep}${signature}` : signature;
};

module.exports = { appendSignatureIfMissing };
