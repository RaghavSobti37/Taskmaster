export const CALENDAR_EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'instagram_post', label: 'Instagram Post' },
  { value: 'youtube_post', label: 'Youtube Post' },
  { value: 'shoot_day', label: 'Shoot day' },
  { value: 'event', label: 'Events' },
  { value: 'musical_day', label: 'Musical Day' },
];

export const CALENDAR_EVENT_TYPE_LABELS = Object.fromEntries(
  CALENDAR_EVENT_TYPES.map((t) => [t.value, t.label])
);

export function getCalendarEventTypeLabel(event) {
  if (event?.type === 'holiday') return 'Holiday';
  if (event?.type === 'task') return 'Task';
  if (event?.type === 'google') return 'Google';
  return CALENDAR_EVENT_TYPE_LABELS[event?.eventType] || 'Events';
}
