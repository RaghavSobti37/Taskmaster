/** TSC office holidays — extend per year as needed. Dates are stored as ISO calendar-day keys. */
const OFFICE_HOLIDAYS_BY_YEAR = {
  2026: [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-03-04', name: 'Holi' },
    { date: '2026-03-21', name: 'Id-ul-Fitr' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-05-01', name: 'Buddha Purnima & Maharashtra Day' },
    { date: '2026-05-27', name: 'Id-ul-Zuha (Bakrid)' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-09-04', name: 'Janmashtami' },
    { date: '2026-09-14', name: 'Ganesh Chaturthi' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra' },
    { date: '2026-11-08', name: 'Diwali (Deepavali)' },
    { date: '2026-12-25', name: 'Christmas Day' },
  ],
};

export function getOfficeHoliday(date) {
  const key = toDateKey(date);
  const year = key.slice(0, 4);
  const list = OFFICE_HOLIDAYS_BY_YEAR[year] || [];
  return list.find((h) => h.date === key) || null;
}

export function isOfficeHoliday(date) {
  return Boolean(getOfficeHoliday(date));
}

export function getHolidayLabel(date) {
  const office = getOfficeHoliday(date);
  if (office) return office.name;
  const weekday = weekdayShort(date);
  if (weekday === 'Sat') return 'Saturday';
  if (weekday === 'Sun') return 'Sunday';
  return 'Holiday';
}

function toDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekdayShort(date) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(value);
}

export { OFFICE_HOLIDAYS_BY_YEAR };
