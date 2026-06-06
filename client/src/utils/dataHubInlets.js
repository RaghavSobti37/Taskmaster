/** ESM helper — keep in sync with shared/dataInlets.js dedupeInletEntries */

export function dedupeInletEntries(inlets = []) {
  const map = new Map();
  for (const inlet of inlets) {
    if (!inlet?.key) continue;
    if (!map.has(inlet.key)) {
      map.set(inlet.key, inlet);
    }
  }
  return [...map.values()];
}

/** Icon name (lucide) + label per inlet key */
export const INLET_META = {
  exly: { key: 'exly', label: 'Exly', icon: 'ShoppingBag' },
  leads: { key: 'leads', label: 'Leads', icon: 'UserPlus' },
  outsourced: { key: 'outsourced', label: 'Outsourced Data', icon: 'FileSpreadsheet' },
  newsletter: { key: 'newsletter', label: 'Newsletter', icon: 'Mail' },
  artist_path: { key: 'artist_path', label: 'Artist Path', icon: 'Music' },
  tsc: { key: 'outsourced', label: 'Outsourced Data', icon: 'FileSpreadsheet' },
  booked_calls: { key: 'booked_calls', label: 'Booked Calls', icon: 'Phone' },
  enquiries: { key: 'enquiries', label: 'Enquiries', icon: 'MessageSquare' },
  unsubscribed: { key: 'unsubscribed', label: 'Unsubscribed', icon: 'UserX' },
  mail: { key: 'mail', label: 'Mail Engagement', icon: 'Mail' },
  community: { key: 'community', label: 'Community', icon: 'UsersRound' },
  active: { key: 'active', label: 'Active Users', icon: 'Activity' },
  loyal: { key: 'loyal', label: 'Loyal Customers', icon: 'Star' },
};
