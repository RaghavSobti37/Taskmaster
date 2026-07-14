import {
  ORG_FEATURE_KEYS,
  ORG_FEATURE_CATALOG,
  defaultFeatureUnlocks,
} from '@shared/orgFeatures';

export const ORG_CREATE_STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Profile' },
  { id: 3, label: 'Features' },
  { id: 4, label: 'Invites' },
  { id: 5, label: 'Review' },
];

export const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'creative-media', label: 'Creative & media' },
  { value: 'professional-services', label: 'Professional services' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'retail', label: 'Retail & e-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'other', label: 'Other' },
];

export const TEAM_SIZE_OPTIONS = [
  { value: '1-5', label: '1–5' },
  { value: '6-20', label: '6–20' },
  { value: '21-50', label: '21–50' },
  { value: '50+', label: '50+' },
];

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Japan' },
  { value: 'Europe/London', label: 'United Kingdom' },
  { value: 'Europe/Paris', label: 'Central Europe' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Chicago', label: 'US Central' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'Australia/Sydney', label: 'Australia' },
  { value: 'UTC', label: 'UTC' },
];

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian rupee' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British pound' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'SGD', label: 'SGD — Singapore dollar' },
  { value: 'AED', label: 'AED — UAE dirham' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
];

/** Maps to Tenant.settings.dateFormat */
export const TENANT_DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '29/06/2026' },
];

export const ORG_INVITE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

export const slugifyOrgSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

export const initialsOrgSlug = (name) => {
  const parts = String(name || '')
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const initials = parts.map((part) => part[0]).join('');
  return slugifyOrgSlug(initials).slice(0, 16);
};

export const orgInitials = (name) => {
  const parts = String(name || 'Organization').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || 'OR').toUpperCase();
};

export const labelForOption = (options, value) => options.find((o) => o.value === value)?.label || value || '—';

export const EMPTY_INVITE_ROW = { email: '', role: '' };

export const defaultOrgCreateForm = () => ({
  name: '',
  slug: '',
  slugManual: false,
  logoUrl: null,
  industry: '',
  teamSize: '',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  features: defaultFeatureUnlocks(),
  invites: [{ ...EMPTY_INVITE_ROW }],
});

export function buildCreateTenantPayload(form) {
  const invites = (form.invites || [])
    .filter((row) => String(row.email || '').trim())
    .map((row) => ({
      email: String(row.email).trim().toLowerCase(),
      role: row.role,
    }));

  const payload = {
    name: String(form.name).trim(),
    slug: slugifyOrgSlug(form.slug || form.name),
    industry: form.industry,
    teamSize: form.teamSize,
    settings: {
      timezone: form.timezone,
      defaultCurrency: form.currency,
      dateFormat: form.dateFormat,
    },
    featureUnlocks: form.features || defaultFeatureUnlocks(),
    invites,
  };

  if (form.logoUrl) {
    payload.branding = { logoUrl: form.logoUrl };
    payload.logo = form.logoUrl;
  }

  return payload;
}
