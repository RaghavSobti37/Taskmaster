import { formatDisplayDateShort } from './dateDisplay';

export const formatChartData = (history, platform) => {
  if (!history || !Array.isArray(history)) return [];

  return history.map((item) => {
    const dateRaw = item.timestamp || item.date;
    const dateStr = dateRaw
      ? formatDisplayDateShort(dateRaw, { emptyLabel: '' })
      : '';

    const metrics = item.metrics || item;
    let value;

    if (platform === 'spotify') {
      value = metrics.followers ?? metrics.value ?? 0;
    } else if (platform === 'youtube') {
      value = metrics.subscribers ?? metrics.views ?? metrics.value ?? 0;
    } else if (platform === 'instagram' || platform === 'meta') {
      value = metrics.followers ?? metrics.likes ?? metrics.value ?? 0;
    } else {
      value = metrics.value ?? metrics.followers ?? metrics.subscribers ?? 0;
    }

    return { label: dateStr, name: dateStr, value: Number(value) || 0 };
  });
};
