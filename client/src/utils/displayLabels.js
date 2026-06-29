import { format } from 'date-fns';
import { DATETIME_DISPLAY_SECONDS_FORMAT } from './dateDisplay';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../constants/taskOptions';

const TIMEFRAME_LABELS = {
  '1d': '1 day',
  '7d': '7 days',
  '30d': '30 days',
};

export function formatTimeframeLabel(timeframe) {
  return TIMEFRAME_LABELS[timeframe] || timeframe || 'period';
}

export function formatTaskStatus(status) {
  if (!status) return '—';
  const match = STATUS_OPTIONS.find((o) => o.value === status);
  return match?.label || String(status).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTaskPriority(priority) {
  if (!priority) return '—';
  const match = PRIORITY_OPTIONS.find((o) => o.value === priority);
  return match?.label || String(priority).replace(/\b\w/g, (c) => c.toUpperCase());
}

const INBOX_CATEGORY_LABELS = {
  all: 'All',
  task: 'Tasks',
  review: 'Reviews',
  crm: 'CRM',
  attendance: 'Attendance',
};

export function formatInboxCategory(category) {
  return INBOX_CATEGORY_LABELS[category] || String(category).replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Display timestamp with local timezone abbreviation */
export function formatTimestampWithTz(date, pattern = DATETIME_DISPLAY_SECONDS_FORMAT) {
  if (!date) return '—';
  try {
    const d = date instanceof Date ? date : new Date(date);
    const tz = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value || '';
    return `${format(d, pattern)}${tz ? ` ${tz}` : ''}`;
  } catch {
    return '—';
  }
}

function formatShortTimestampWithTz(date, pattern = 'dd/MM/yyyy HH:mm:ss') {
  return formatTimestampWithTz(date, pattern);
}
