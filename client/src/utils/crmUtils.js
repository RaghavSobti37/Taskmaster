export const SALES_REPS = {
  'sr01': 'Rohit Sobti',
  'sr02': 'Deepank Soni',
  'sr03': 'Rinki Roy',
  'sr04': 'Redacted User',
  'sr05': 'Sonesh Jain',
  'sr06': 'Satyam Mishra',
  'sr07': 'Shivam Sahijwani',
  'sr08': 'Harshika Kasliwal',
  'sr09': 'Aryaman',
  'akash': 'Akash'
};

const getRepName = (rep) => {
  if (!rep) return 'UNASSIGNED';
  if (typeof rep === 'object' && rep.name) return rep.name;
  return SALES_REPS[rep] || rep;
};

export const MEANINGFUL_CONNECT_DEFAULT = 'PENDING';

/** Manual rep flag — not derived from call status or funnel stage. */
export const MEANINGFUL_CONNECT_OPTIONS = [
  { value: 'PENDING', label: 'Pending — not assessed yet' },
  { value: 'YES', label: 'Yes — had a meaningful conversation' },
  { value: 'NO', label: 'No — no meaningful connect' },
];

export function formatMeaningfulConnect(value) {
  const key = String(value || MEANINGFUL_CONNECT_DEFAULT).toUpperCase();
  if (key === 'YES') return 'Yes';
  if (key === 'NO') return 'No';
  return 'Pending';
}

export function meaningfulConnectBadgeVariant(value) {
  const key = String(value || MEANINGFUL_CONNECT_DEFAULT).toUpperCase();
  if (key === 'YES') return 'mint';
  if (key === 'NO') return 'slate';
  return 'warning';
}

export const formatExlyTag = (title) => {
  if (!title) return null;
  const lower = title.toLowerCase();
  if (lower.includes('hindustani classical masterclass')) return 'Classical Masterclass';
  if (lower.includes('production')) return 'Music Production';
  if (lower.includes('vocal')) return 'Vocal Training';
  if (lower.includes('guitar')) return 'Guitar Masterclass';
  // Fallback to max 3 words
  const words = title.split(' ');
  return words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
};
