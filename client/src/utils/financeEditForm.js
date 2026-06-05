import { cloneSnapshot } from '../hooks/useUnsavedChanges';

/** Build finance document edit form from API doc + project list. */
export function buildFinanceEditForm(selectedDoc, projects = []) {
  if (!selectedDoc) return null;
  const projectId = selectedDoc.project?._id || selectedDoc.project || '';
  const projectRecord = projects.find((p) => p._id === projectId);
  return {
    title: selectedDoc.title || '',
    description: selectedDoc.description || '',
    workspace: projectRecord?.workspace || 'General',
    project: projectId,
    category: selectedDoc.category || 'other',
    metadata: {
      vendor: selectedDoc.metadata?.vendor || '',
      amount: selectedDoc.metadata?.amount || 0,
      currency: selectedDoc.metadata?.currency || 'INR',
      tax: selectedDoc.metadata?.tax || 0,
      date: selectedDoc.metadata?.date
        ? new Date(selectedDoc.metadata.date).toISOString().split('T')[0]
        : '',
    },
  };
}

export function financeEditPayload(editForm, selectedDoc) {
  return {
    title: editForm.title,
    description: editForm.description,
    project: editForm.project || null,
    category: editForm.category,
    metadata: {
      ...selectedDoc.metadata,
      vendor: editForm.metadata.vendor,
      amount: parseFloat(editForm.metadata.amount) || 0,
      currency: editForm.metadata.currency,
      tax: parseFloat(editForm.metadata.tax) || 0,
      date: editForm.metadata.date ? new Date(editForm.metadata.date) : null,
    },
  };
}

export function cloneFinanceEditForm(form) {
  return cloneSnapshot(form);
}
