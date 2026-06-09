export function isArtistBookingEnquiry(lead) {
  if (!lead) return false;
  if (lead.contactCategory === 'booking_enquiry') return true;
  return /website artist enquiry|artist booking enquiry/i.test(String(lead.source || ''));
}

export const BOOKING_ENQUIRY_FIELDS = [
  { key: 'artist', label: 'Artist / Talent', leadKey: 'artistProject' },
  { key: 'company', label: 'Company / Organization' },
  { key: 'collaborationType', label: 'Collaboration Type' },
  { key: 'nature', label: 'Project Nature' },
  { key: 'whenWhere', label: 'When & Where' },
  { key: 'scaleReach', label: 'Scale / Reach' },
  { key: 'logistics', label: 'Logistics Support' },
  { key: 'vision', label: 'Vision / Details' },
];

export function getBookingEnquiryRows(lead) {
  if (!isArtistBookingEnquiry(lead)) return [];
  const meta = lead.metadata || {};
  return BOOKING_ENQUIRY_FIELDS.map(({ key, label, leadKey }) => {
    const value = meta[key] || (leadKey ? lead[leadKey] : '') || '';
    const text = String(value).trim();
    if (!text) return null;
    return { key, label, value: text };
  }).filter(Boolean);
}
