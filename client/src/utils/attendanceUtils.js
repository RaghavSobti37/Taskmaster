import { getDay } from 'date-fns';

export const isWeekend = (date = new Date()) => {
  const day = getDay(date);
  return day === 0 || day === 6;
};
