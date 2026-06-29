import { parseISO, isValid } from 'date-fns';
import { formatDateKeyForDisplay } from './dateDisplay';
import { TASK_CATEGORY_OPTIONS, SLOT_OPTIONS } from '../constants/taskOptions';
import { formatTaskStatus } from './displayLabels';
import { TASK_STATUS_BUTTON_OPTIONS } from './taskStatusButtons';

export const FIELD_ACTIVITY_LABELS = {
  category: 'Category',
  slot: 'Slot',
  scheduleDate: 'Start date',
  dueDate: 'End date',
};

function formatDateValue(value) {
  if (!value) return '—';
  const d = parseISO(String(value).slice(0, 10));
  if (!isValid(d)) return String(value);
  return formatDateKeyForDisplay(d);
}

export function formatFieldActivityValue(fieldKey, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  switch (fieldKey) {
    case 'category': {
      const opt = TASK_CATEGORY_OPTIONS.find((c) => c.value === raw.toLowerCase());
      return opt?.label || raw;
    }
    case 'slot': {
      const opt = SLOT_OPTIONS.find((s) => s.value === raw.toUpperCase());
      return opt?.label || raw;
    }
    case 'scheduleDate':
    case 'dueDate':
      return formatDateValue(raw);
    case 'status': {
      const opt = TASK_STATUS_BUTTON_OPTIONS.find((s) => s.value === raw.toLowerCase());
      return opt?.label || formatTaskStatus(raw);
    }
    default:
      return raw;
  }
}
