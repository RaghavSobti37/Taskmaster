import { addDays, format } from 'date-fns';
import { isOfficeHoliday, getHolidayLabel } from './officeHolidays';

export { getHolidayLabel, isOfficeHoliday };

const APP_TIMEZONE = 'Asia/Kolkata';

/** Self-service check-in recorded (manual or system stamp). */
export const hasRecordedCheckIn = (entry) =>
  !!(entry?.inTimeRecord?.manualTimestamp || entry?.inTimeRecord?.systemTimestamp);

/** Self-service check-out recorded (manual or system stamp). */
export const hasRecordedCheckOut = (entry) =>
  !!(entry?.outTimeRecord?.manualTimestamp || entry?.outTimeRecord?.systemTimestamp);

/** HH:mm for time card display from an in/out record. */
export const formatAttendanceRecordTime = (record) => {
  if (!record) return '';
  const manual = typeof record.manualTimestamp === 'string' ? record.manualTimestamp.trim() : '';
  if (manual) return manual;
  if (record.systemTimestamp) {
    return new Date(record.systemTimestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return '';
};

/** After this hour (IST), self-mark UI defaults to Mark Out with optional Mark In reveal. */
export const ATTENDANCE_MARKOUT_CUTOFF_HOUR = 13;

export const getISTHourMinute = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour, minute };
};

export const isAtOrAfterMarkOutCutoff = (date = new Date()) => {
  const { hour } = getISTHourMinute(date);
  return hour >= ATTENDANCE_MARKOUT_CUTOFF_HOUR;
};

/**
 * Self-service Mark In/Out panel visibility (compact + full time card).
 * Before 13:00 IST: In only until checked in, then Out only.
 * After 13:00 IST: Out primary; In via optional expand when not yet checked in.
 * Attendance page (`alwaysShowMarkInAccess`): In panel always visible (incl. after check-in); both panels when not checked in after 13:00 (no buried toggle).
 */
export const getSelfMarkPanelVisibility = ({
  hasIn,
  hasOut,
  showInExpanded = false,
  alwaysShowMarkInAccess = false,
  now = new Date(),
} = {}) => {
  const afterCutoff = isAtOrAfterMarkOutCutoff(now);

  if (hasIn && hasOut) {
    return { showInPanel: true, showOutPanel: true, showMarkInToggle: false };
  }

  if (hasIn && !hasOut) {
    if (alwaysShowMarkInAccess) {
      return { showInPanel: true, showOutPanel: true, showMarkInToggle: false };
    }
    return { showInPanel: false, showOutPanel: true, showMarkInToggle: false };
  }

  if (!hasIn) {
    if (afterCutoff) {
      if (alwaysShowMarkInAccess) {
        return { showInPanel: true, showOutPanel: true, showMarkInToggle: false };
      }
      return {
        showInPanel: showInExpanded,
        showOutPanel: !showInExpanded,
        showMarkInToggle: !showInExpanded,
      };
    }
    return { showInPanel: true, showOutPanel: false, showMarkInToggle: false };
  }

  return { showInPanel: true, showOutPanel: true, showMarkInToggle: false };
};

const WEEKDAY_OFFSET_FROM_MONDAY = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export const formatDateKeyIST = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
};

const dateKeyToLocalDate = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const getMondayDateKeyIST = (referenceDate = new Date()) => {
  const dateKey = typeof referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate.trim())
    ? referenceDate.trim()
    : formatDateKeyIST(referenceDate);
  const anchor = dateKeyToLocalDate(dateKey);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(anchor);
  const daysFromMonday = WEEKDAY_OFFSET_FROM_MONDAY[weekday] ?? 0;
  anchor.setDate(anchor.getDate() - daysFromMonday);
  return formatDateKeyIST(anchor);
};

export const getWeekDaysIST = (referenceDate = new Date()) => {
  const mondayKey = getMondayDateKeyIST(referenceDate);
  const monday = dateKeyToLocalDate(mondayKey);
  const todayKey = formatDateKeyIST(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const dateKey = formatDateKeyIST(date);
    const shortLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(date);
    return {
      key: dateKey,
      label: dateKey === todayKey ? 'Today' : shortLabel,
      shortLabel,
      date,
      isToday: dateKey === todayKey,
    };
  });
};

export const isWeekend = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(value);
  return weekday === 'Sat' || weekday === 'Sun';
};

/** Weekend or listed office holiday — not the same as approved leave. */
export const isAttendanceHoliday = (date = new Date()) => isWeekend(date) || isOfficeHoliday(date);

export const shouldUseSplitLayout = (entry, status) => {
  if (status === 'leave' || status === 'holiday' || status === 'empty') return false;
  if (!entry?.inTimeRecord?.manualTimestamp && !entry?.outTimeRecord?.manualTimestamp) return false;
  return true;
};

export const getMergedCellLabel = (status, date) => {
  if (status === 'holiday') return getHolidayLabel(date) || 'Holiday';
  if (status === 'leave') return 'Leave';
  if (status === 'halfDay') return 'Half Day';
  return 'Mark Present';
};

export const inferEditScope = (entry) => {
  if (!entry?.inTimeRecord?.manualTimestamp) return 'in';
  if (!entry?.outTimeRecord?.manualTimestamp) return 'out';
  return 'in';
};

/** Shared status resolver for all attendance views. */
export const resolveAttendanceStatus = (entry, date) => {
  if (entry?.onLeave && !entry.inTimeRecord?.manualTimestamp && !entry.outTimeRecord?.manualTimestamp) return 'leave';
  if (entry?.isHalfDay && !entry.inTimeRecord?.manualTimestamp && !entry.outTimeRecord?.manualTimestamp) return 'halfDay';
  if (entry?.inTimeRecord?.manualTimestamp || entry?.outTimeRecord?.manualTimestamp) return 'present';
  if (isAttendanceHoliday(date)) return 'holiday';
  return 'empty';
};
