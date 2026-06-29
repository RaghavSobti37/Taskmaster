import { File, FileSpreadsheet, FileText, Image as ImageIcon } from 'lucide-react';
import { formatDisplayDate } from './dateDisplay';

export const FINANCE_CATEGORIES = [
  { value: 'all', label: 'All Types' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'budget', label: 'Budget' },
  { value: 'report', label: 'Report' },
  { value: 'tax', label: 'Tax' },
  { value: 'other', label: 'Other' },
];

export const FINANCE_CAT_COLORS = {
  invoice: { bg: '#E6F4EA', text: '#137333', darkBg: '#0F2916', darkText: '#81C995' },
  receipt: { bg: '#F1F3F4', text: '#3C4043', darkBg: '#202124', darkText: '#BDC1C6' },
  contract: { bg: '#E6F4EA', text: '#137333', darkBg: '#0F2916', darkText: '#81C995' },
  proposal: { bg: '#FEF7E0', text: '#B06000', darkBg: '#2E2003', darkText: '#FDD663' },
  budget: { bg: '#FEF7E0', text: '#B06000', darkBg: '#2E2003', darkText: '#FDD663' },
  report: { bg: '#F1F3F4', text: '#3C4043', darkBg: '#202124', darkText: '#BDC1C6' },
  tax: { bg: '#FCE8E6', text: '#C5221F', darkBg: '#30100F', darkText: '#F28B82' },
  other: { bg: '#F1F3F4', text: '#3C4043', darkBg: '#202124', darkText: '#BDC1C6' },
};

export const formatFinanceBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const formatFinanceDocDate = (doc) => {
  const raw = doc?.metadata?.date;
  if (!raw) return '—';
  return formatDisplayDate(raw);
};

export const getFinanceFileIcon = (type) => {
  if (!type) return File;
  if (type.includes('pdf')) return FileText;
  if (type.includes('sheet') || type.includes('csv') || type.includes('excel')) return FileSpreadsheet;
  if (type.includes('image')) return ImageIcon;
  return File;
};

export function buildFinanceTableRows(docs, { currentFolderId, selectedProject } = {}) {
  const rows = [];
  docs.forEach((doc, index) => {
    const prev = docs[index - 1];
    const showRootDivider =
      !currentFolderId
      && selectedProject
      && !doc.isFolder
      && prev?.isFolder;
    if (showRootDivider) {
      rows.push({
        _id: `divider-root-${doc._id}`,
        _isDivider: true,
        label: 'Documents at project root',
      });
    }
    rows.push(doc);
  });
  return rows;
}
