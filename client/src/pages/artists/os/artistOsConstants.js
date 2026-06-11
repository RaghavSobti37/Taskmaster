export const ARTIST_OS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'gigs', label: 'Gigs' },
  { id: 'finance', label: 'Finance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'content', label: 'Content' },
  { id: 'releases', label: 'Releases' },
  { id: 'notes', label: 'Team Notes' },
  { id: 'documents', label: 'Documents' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'team', label: 'Team' },
];

export const CALENDAR_EVENT_COLORS = {
  inquiry: { bg: 'bg-amber-400', label: 'Inquiry', hex: '#fbbf24' },
  gig: { bg: 'bg-emerald-500', label: 'Confirmed Gig', hex: '#10b981' },
  dead: { bg: 'bg-rose-500', label: 'Dead Inquiry', hex: '#f43f5e' },
  personal: { bg: 'bg-blue-500', label: 'Personal', hex: '#3b82f6' },
  release: { bg: 'bg-purple-500', label: 'Release', hex: '#a855f7' },
};

/** Unified booking pipeline — maps to ArtistInquiry.status */
export const BOOKING_PIPELINE_STAGES = [
  { id: 'new', label: 'Lead', variant: 'info' },
  { id: 'contacted', label: 'Discussion', variant: 'slate' },
  { id: 'negotiating', label: 'Negotiation', variant: 'warning' },
  { id: 'verbal_confirmation', label: 'Verbal Confirmation', variant: 'apricot' },
  { id: 'contract_sent', label: 'Contract Sent', variant: 'info' },
  { id: 'confirmed', label: 'Confirmed', variant: 'success' },
  { id: 'completed', label: 'Completed', variant: 'success' },
  { id: 'paid', label: 'Paid', variant: 'success' },
];

export const INQUIRY_STATUSES = [
  ...BOOKING_PIPELINE_STAGES,
  { id: 'blocked', label: 'Blocked', variant: 'apricot' },
  { id: 'dead', label: 'Dead', variant: 'rose' },
];

export const ASSET_TYPES = [
  { id: 'artwork', label: 'Artwork' },
  { id: 'poster', label: 'Poster' },
  { id: 'epk', label: 'EPK' },
  { id: 'logo', label: 'Logo' },
  { id: 'press', label: 'Press' },
  { id: 'video', label: 'Video' },
  { id: 'brand', label: 'Brand' },
];

export const EXPENSE_CATEGORIES = [
  'Travel', 'Hotel', 'Food', 'Production', 'Marketing', 'Management', 'Misc',
];

export const REVENUE_CATEGORIES = [
  'Gig', 'Royalty', 'Brand Deal', 'Workshop', 'Sponsorship',
];

export const formatInr = (amount) => {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
};
