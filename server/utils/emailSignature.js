const appendSignatureIfMissing = (html, signature) => {
  if (!signature || !String(signature).trim()) return html || '';
  const content = html || '';
  if (content.includes(signature)) return content;
  return content + (content ? '<br/><br/>' : '') + signature;
};

module.exports = { appendSignatureIfMissing };
