import { stableJsonEqual } from '../hooks/useUnsavedChanges';

export function buildOfferingEditState({
  title = '',
  price = 0,
  type = 'program',
  status = 'active',
  eventDate = '',
  eventTime = '',
}) {
  return { title, price, type, status, eventDate, eventTime };
}

export function offeringEditHasChanges(editState, baseline) {
  return !!baseline && !stableJsonEqual(editState, baseline);
}
