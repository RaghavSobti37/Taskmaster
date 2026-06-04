/** Parse Exly money fields (₹ 4,999 / "4999" / numbers). */
const parseExlyMoney = (raw) => {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const cleaned = String(raw).replace(/[₹$,\s]/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** List price from Exly offering API payload (field names vary). */
const resolveOfferingPriceFromApi = (off = {}) => {
  const candidates = [
    off.price,
    off.listPrice,
    off.list_price,
    off.sellingPrice,
    off.selling_price,
    off.basePrice,
    off.base_price,
    off.amount,
    off.offeringPrice,
    off.pricing?.price,
    off.pricing?.amount,
    off.pricing?.listPrice,
    off.metadata?.price,
    off.metadata?.amount,
  ];
  for (const raw of candidates) {
    const n = parseExlyMoney(raw);
    if (n > 0) return n;
  }
  return 0;
};

/** Infer catalog list price from paid booking amounts (mode of pricePaid > 0). */
const inferListPriceFromBookings = (bookings = []) => {
  const freq = new Map();
  for (const booking of bookings) {
    const n = parseExlyMoney(booking?.pricePaid);
    if (n <= 0) continue;
    const key = Math.round(n);
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [price, count] of freq.entries()) {
    if (count > bestCount || (count === bestCount && price > best)) {
      bestCount = count;
      best = price;
    }
  }
  return best;
};

const parseOfferingTitle = (title) => {
  if (!title) return { cleanTitle: '', dateStr: '', timeStr: '' };
  const parts = title.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    return {
      cleanTitle: parts.slice(2).join(' | '),
      dateStr: parts[0],
      timeStr: parts[1]
    };
  } else if (parts.length === 2) {
    return {
      cleanTitle: parts[1],
      dateStr: parts[0],
      timeStr: ''
    };
  }
  return { cleanTitle: title, dateStr: '', timeStr: '' };
};

const shouldIgnoreOffering = (title, offeringId) => {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  const lowerId = (offeringId || '').toLowerCase().trim();
  return lower === 'testing br community' || 
         lower === 'program name' || 
         lower === 'testing' ||
         lower === 'demo community' ||
         lower === 'demo day- results' ||
         lowerId === 'demo-community' ||
         lowerId === 'demo-day--results';
};

module.exports = {
  parseExlyMoney,
  resolveOfferingPriceFromApi,
  inferListPriceFromBookings,
  parseOfferingTitle,
  shouldIgnoreOffering,
};
