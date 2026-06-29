export const FINANCE_CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const ALLOWED = new Set(FINANCE_CURRENCY_OPTIONS.map((o) => o.value));

/** Default INR; only allow INR / USD / EUR in UI. */
export function normalizeFinanceCurrency(value) {
  const code = String(value || 'INR').trim().toUpperCase();
  return ALLOWED.has(code) ? code : 'INR';
}
