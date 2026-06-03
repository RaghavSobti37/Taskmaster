import {
  formatDateKeyIST,
  getISTHourMinute,
  isAttendanceHoliday,
} from './attendanceUtils';

export const ATTENDANCE_PROMPT_HOUR_IST = 9;
export const ATTENDANCE_SESSION_LOGIN_KEY = 'tm-att-session-login-ts';
export const ATTENDANCE_PROMPTED_PREFIX = 'tm-attendance-prompted';

export const isAtOrAfterAttendancePromptHour = (date = new Date()) => {
  const { hour } = getISTHourMinute(date);
  return hour >= ATTENDANCE_PROMPT_HOUR_IST;
};

export const getAttendancePromptedStorageKey = (userId, dateKey = formatDateKeyIST()) =>
  `${ATTENDANCE_PROMPTED_PREFIX}-${userId}-${dateKey}`;

export const wasAttendancePromptedToday = (userId) => {
  if (!userId || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(getAttendancePromptedStorageKey(userId)) === '1';
};

export const markAttendancePromptedToday = (userId) => {
  if (!userId || typeof localStorage === 'undefined') return;
  localStorage.setItem(getAttendancePromptedStorageKey(userId), '1');
};

export const clearAttendancePromptedToday = (userId) => {
  if (!userId || typeof localStorage === 'undefined') return;
  localStorage.removeItem(getAttendancePromptedStorageKey(userId));
};

export const recordAttendanceSessionLogin = () => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(ATTENDANCE_SESSION_LOGIN_KEY, String(Date.now()));
};

export const clearAttendanceSessionLogin = () => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(ATTENDANCE_SESSION_LOGIN_KEY);
};

/** Session started via login or restored cookie; timestamp set once per browser session. */
export const getAttendanceSessionLoginAt = () => {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(ATTENDANCE_SESSION_LOGIN_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? new Date(value) : null;
};

export const ensureAttendanceSessionLoginRecorded = () => {
  if (typeof sessionStorage === 'undefined') return;
  if (!sessionStorage.getItem(ATTENDANCE_SESSION_LOGIN_KEY)) {
    recordAttendanceSessionLogin();
  }
};

/** True when this browser session began at or after 9:00 IST (login or cookie restore). */
export const isSessionLoginAtOrAfterPromptHour = () => {
  const loginAt = getAttendanceSessionLoginAt();
  if (!loginAt) return false;
  return isAtOrAfterAttendancePromptHour(loginAt);
};

export const hasMarkedAttendanceInToday = (entry) =>
  !!(entry?.inTimeRecord?.manualTimestamp || entry?.inTimeRecord?.systemTimestamp);

export const shouldShowAttendancePrompt = ({ user, entry, attendanceLoading }) => {
  if (!user?._id || user.mustChangePassword) return false;
  if (attendanceLoading) return false;

  const today = new Date();
  if (!isAtOrAfterAttendancePromptHour(today)) return false;
  if (!isSessionLoginAtOrAfterPromptHour()) return false;
  if (wasAttendancePromptedToday(user._id)) return false;
  if (hasMarkedAttendanceInToday(entry)) return false;
  if (entry?.onLeave) return false;
  if (isAttendanceHoliday(today)) return false;

  return true;
};
