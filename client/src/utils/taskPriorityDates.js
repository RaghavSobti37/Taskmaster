import { addDays, format, parse, isValid } from 'date-fns';
import { getPriorityDaySpan } from '../constants/taskOptions';
import { getTodayDateKey } from './dateValidation';

function parseDateInput(value) {
  if (!value) return new Date();
  if (value instanceof Date && isValid(value)) return value;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parsed = parse(str, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) return parsed;
  }
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : new Date();
}

/** Returns yyyy-MM-dd due date = start + priority day span (calendar days). */
export function computeDueDateFromStart(startDate, priority) {
  const days = getPriorityDaySpan(priority);
  return format(addDays(parseDateInput(startDate), days), 'yyyy-MM-dd');
}

export function todayDateString() {
  return getTodayDateKey();
}
