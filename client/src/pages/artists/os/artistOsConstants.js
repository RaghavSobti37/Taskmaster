export const ARTIST_OS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'gigs', label: 'Gigs' },
  { id: 'finance', label: 'Finance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'content', label: 'Content' },
  { id: 'notes', label: 'Team Notes' },
  { id: 'documents', label: 'Documents' },
  { id: 'contracts', label: 'Contracts' },
];

export const CALENDAR_EVENT_COLORS = {
  inquiry: { bg: 'bg-amber-400', label: 'Inquiry', hex: '#fbbf24' },
  gig: { bg: 'bg-emerald-500', label: 'Confirmed Gig', hex: '#10b981' },
  dead: { bg: 'bg-rose-500', label: 'Dead Inquiry', hex: '#f43f5e' },
  personal: { bg: 'bg-blue-500', label: 'Personal', hex: '#3b82f6' },
  release: { bg: 'bg-purple-500', label: 'Release', hex: '#a855f7' },
};

export const INQUIRY_STATUSES = [
  { id: 'new', label: 'New', variant: 'info' },
  { id: 'contacted', label: 'Contacted', variant: 'slate' },
  { id: 'negotiating', label: 'Negotiating', variant: 'warning' },
  { id: 'blocked', label: 'Blocked', variant: 'apricot' },
  { id: 'confirmed', label: 'Confirmed', variant: 'success' },
  { id: 'dead', label: 'Dead', variant: 'rose' },
];

export const EXPENSE_CATEGORIES = [
  'Travel', 'Hotel', 'Food', 'Production', 'Marketing', 'Management', 'Misc',
];

export const formatInr = (amount) => {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
};
