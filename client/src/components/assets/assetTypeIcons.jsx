import React from 'react';
import { Link2 } from 'lucide-react';

/** Detect asset type from stored type or URL */
export function detectAssetType(type, link = '') {
  const url = (link || '').toLowerCase();
  if (type && type !== 'other') return type;
  if (url.includes('docs.google.com/spreadsheets')) return 'sheet';
  if (url.includes('docs.google.com/document')) return 'docs';
  if (url.includes('docs.google.com/presentation')) return 'presentation';
  if (url.includes('drive.google.com')) return 'drive';
  if (url.includes('meet.google.com')) return 'meet';
  if (url.includes('zoom.us') || url.includes('zoom.com') || url.includes('zoomgov.com')) return 'zoom';
  return 'other';
}

const LABELS = {
  drive: 'Google Drive',
  sheet: 'Google Sheet',
  docs: 'Google Doc',
  presentation: 'Google Slides',
  meet: 'Google Meet',
  zoom: 'Zoom Recording',
  other: 'Link',
};

/** Theme-aware shell; brand colors live inside the SVG only */
export function getAssetTypeConfig(type, link) {
  const detected = detectAssetType(type, link);
  return {
    type: detected,
    label: LABELS[detected] || LABELS.other,
    shellClass:
      'border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--color-bg-workspace)]',
  };
}

const px = (size) => (typeof size === 'number' ? size : parseInt(size, 10) || 14);

function GoogleDriveIcon({ size }) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path fill="#0066DA" d="M8.1 3 2.5 12.6 8.1 22h7.3l5.6-9.6H8.1V3z" />
      <path fill="#00AC47" d="M15.4 3H8.1l3.65 6.3h9.15L15.4 3z" />
      <path fill="#EA4335" d="M2.5 12.6 8.1 22h11.8l5.6-9.6H8.1l-3.6-6.2-2 6.4z" />
      <path fill="#FFBA00" d="M8.1 3 2.5 12.6l5.6 9.4h3.65L8.1 12.6 11.75 3H8.1z" />
    </svg>
  );
}

function GoogleDocsIcon({ size }) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path fill="#A1C2FA" d="M14 2v6h6" />
      <path fill="#fff" d="M8 11h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z" />
    </svg>
  );
}

function GoogleSheetsIcon({ size }) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path fill="#0F9D58" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path fill="#87CEAC" d="M14 2v6h6" />
      <path fill="#fff" d="M8 10h8v1.5H8zm0 2.5h8v1.5H8zm0 2.5h8v1.5H8zm0 2.5h5v1.5H8z" />
    </svg>
  );
}

function GoogleSlidesIcon({ size }) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path fill="#F4B400" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path fill="#FCE8A6" d="M14 2v6h6" />
      <path fill="#fff" d="M8 12h8v5H8z" />
    </svg>
  );
}

function GoogleMeetIcon({ size }) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path fill="#00897B" d="M6 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
      <path fill="#00BFA5" d="M17 8.5l5-3v13l-5-3V8.5z" />
      <path fill="#fff" d="M8.5 10.5l4 2.5-4 2.5v-5z" />
    </svg>
  );
}

function ZoomIcon({ size }) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#2D8CFF" />
      <path
        fill="#fff"
        d="M6.5 8.2c0-.9.7-1.6 1.6-1.6h4.2c.9 0 1.6.7 1.6 1.6v3.1l3.1-1.8c.7-.4 1.6.1 1.6.9v5.2c0 .8-.9 1.3-1.6.9l-3.1-1.8v3.1c0 .9-.7 1.6-1.6 1.6H8.1c-.9 0-1.6-.7-1.6-1.6V8.2z"
      />
    </svg>
  );
}

const BRAND_ICONS = {
  drive: GoogleDriveIcon,
  sheet: GoogleSheetsIcon,
  docs: GoogleDocsIcon,
  presentation: GoogleSlidesIcon,
  meet: GoogleMeetIcon,
  zoom: ZoomIcon,
};

/** Compact brand mark; accepts Lucide-like `size` prop for StatCard */
export function AssetTypeIcon({ type, link, size = 14, className = '' }) {
  const detected = detectAssetType(type, link);
  const Brand = BRAND_ICONS[detected];
  if (Brand) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>
        <Brand size={size} />
      </span>
    );
  }
  return (
    <Link2
      size={size}
      strokeWidth={2}
      className={`shrink-0 text-[var(--color-text-muted)] ${className}`}
    />
  );
}

/** Icon + theme shell for tables/lists */
export function AssetTypeIconBadge({ type, link, size = 14, className = '' }) {
  const { shellClass } = getAssetTypeConfig(type, link);
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md p-1 ${shellClass} ${className}`}
    >
      <AssetTypeIcon type={type} link={link} size={size} />
    </div>
  );
}

/** StatCard-compatible icon factory */
export function assetStatIcon(fixedType) {
  const StatIcon = ({ size = 12 }) => <AssetTypeIcon type={fixedType} size={size} />;
  return StatIcon;
}

export const ASSET_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'sheet', label: 'Sheets' },
  { value: 'docs', label: 'Docs' },
  { value: 'drive', label: 'Drive' },
  { value: 'presentation', label: 'Slides' },
  { value: 'meet', label: 'Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'other', label: 'Other' },
];

export const ASSET_TYPE_FORM_OPTIONS = [
  { value: 'drive', label: 'Google Drive' },
  { value: 'sheet', label: 'Google Sheet' },
  { value: 'docs', label: 'Google Doc' },
  { value: 'presentation', label: 'Google Slides' },
  { value: 'meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom Recording' },
  { value: 'other', label: 'Other Link' },
];

export const GOOGLE_WORKSPACE_SHORTCUTS = [
  { name: 'Drive', type: 'drive', path: 'drive' },
  { name: 'Sheets', type: 'sheet', path: 'spreadsheets' },
  { name: 'Docs', type: 'docs', path: 'document' },
  { name: 'Meet', type: 'meet', path: 'meet' },
];
