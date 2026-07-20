export function printDomSnapshot({ title = 'Print', contentNode } = {}) {
  if (!contentNode) return false;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup?.document) return false;

  const { document: doc } = popup;
  doc.title = String(title || 'Print');
  doc.body.innerHTML = '';
  doc.body.appendChild(contentNode.cloneNode(true));
  popup.print?.();
  return true;
}
