export function buildOrgEditForm(doc) {
  if (!doc) return null;
  return {
    title: doc.title || '',
    description: doc.description || '',
    category: doc.category || 'Other',
    tags: (doc.tags || []).join(', '),
  };
}

export function cloneOrgEditForm(form) {
  return form ? { ...form } : null;
}

export function orgEditPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    tags: form.tags,
  };
}

export function orgDocumentPreviewPath(doc) {
  if (!doc?._id || doc.sourceType !== 'file') return '';
  return `/api/org-documents/${doc._id}/file`;
}
