const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const { startOfDayFromKey } = require('../utils/attendanceDate');

const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

const MUSIC_CALENDAR_ENTRIES = [
  { month: 'Jan', day: 5, type: 'Birthday', name: 'Ustad Bismillah Khan' },
  { month: 'Jan', day: 8, type: 'Birthday', name: 'Elvis Presley' },
  { month: 'Jan', day: 27, type: 'Birthday', name: 'A. R. Rahman' },
  { month: 'Jan', day: 31, type: 'Birthday', name: 'Mohammed Rafi' },
  { month: 'Feb', day: 13, type: 'Observance', name: 'World Radio Day' },
  { month: 'Feb', day: 18, type: 'Birthday', name: 'Kumar Gandharva' },
  { month: 'Feb', day: 24, type: 'Birthday', name: 'Jagjit Singh' },
  { month: 'Feb', day: 25, type: 'Birthday', name: 'George Harrison' },
  { month: 'Mar', day: 4, type: 'Birthday', name: 'Shankar Mahadevan' },
  { month: 'Mar', day: 8, type: 'Observance', name: "International Women's Day" },
  { month: 'Mar', day: 21, type: 'Birthday', name: 'Ustad Amjad Ali Khan' },
  { month: 'Apr', day: 22, type: 'Birthday', name: 'Yehudi Menuhin' },
  { month: 'Apr', day: 30, type: 'Observance', name: 'International Jazz Day' },
  { month: 'May', day: 9, type: 'Birthday', name: 'Pandit Ravi Shankar' },
  { month: 'May', day: 24, type: 'Birthday', name: 'Bob Dylan' },
  { month: 'Jun', day: 21, type: 'Observance', name: 'World Music Day' },
  { month: 'Jun', day: 22, type: 'Birthday', name: 'Asha Bhosle' },
  { month: 'Jul', day: 6, type: 'Birthday', name: 'M. Balamuralikrishna' },
  { month: 'Jul', day: 26, type: 'Birthday', name: 'Mick Jagger' },
  { month: 'Aug', day: 1, type: 'Birthday', name: 'Kishore Kumar' },
  { month: 'Aug', day: 15, type: 'Observance', name: 'Indian Independence Day Music Content' },
  { month: 'Aug', day: 29, type: 'Birthday', name: 'Michael Jackson' },
  { month: 'Sep', day: 5, type: 'Birthday', name: 'Freddie Mercury' },
  { month: 'Sep', day: 23, type: 'Birthday', name: 'Ray Charles' },
  { month: 'Sep', day: 28, type: 'Birthday', name: 'Lata Mangeshkar' },
  { month: 'Oct', day: 1, type: 'Observance', name: 'International Music Day' },
  { month: 'Oct', day: 9, type: 'Birthday', name: 'John Lennon' },
  { month: 'Oct', day: 13, type: 'Birthday', name: 'Nusrat Fateh Ali Khan' },
  { month: 'Oct', day: 24, type: 'Birthday', name: 'R. D. Burman' },
  { month: 'Nov', day: 4, type: 'Birthday', name: 'P. Susheela' },
  { month: 'Nov', day: 12, type: 'Birthday', name: 'Pandit Bhimsen Joshi' },
  { month: 'Nov', day: 25, type: 'Memorial', name: 'George Harrison Death Anniversary' },
  { month: 'Dec', day: 8, type: 'Memorial', name: 'John Lennon Death Anniversary' },
  { month: 'Dec', day: 24, type: 'Birthday', name: 'Mohammed Rafi' },
  { month: 'Dec', day: 25, type: 'Observance', name: 'Christmas Music Content' },
];

const SOURCE_TAG = 'Music Content Calendar';
const BYPASS = { bypassTenant: true };

function buildEventTimes(month, day, year) {
  const dateKey = `${year}-${MONTHS[month]}-${String(day).padStart(2, '0')}`;
  const dayStart = startOfDayFromKey(dateKey);
  const start = new Date(dayStart.getTime() + 9 * 60 * 60 * 1000);
  const end = new Date(dayStart.getTime() + 10 * 60 * 60 * 1000);
  return { start, end, dateKey };
}

function buildTitle(entry) {
  return `${entry.type}: ${entry.name}`;
}

async function resolveCreatorUser(preferredUserId) {
  if (preferredUserId) {
    const user = await User.findById(preferredUserId).select('_id name tenantId').setOptions(BYPASS);
    if (user) return user;
  }
  const preferred = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).select('_id name tenantId').setOptions(BYPASS);
  if (preferred) return preferred;
  const admin = await User.findOne({ role: 'admin' }).select('_id name tenantId').setOptions(BYPASS);
  if (admin) return admin;
  const any = await User.findOne().select('_id name tenantId').setOptions(BYPASS);
  if (!any) throw new Error('No users found — create a user before seeding calendar events');
  return any;
}

async function seedMusicContentCalendar({
  year = new Date().getFullYear(),
  dryRun = false,
  creatorUserId,
  tenantId,
} = {}) {
  const creator = await resolveCreatorUser(creatorUserId);
  const scopedTenantId = tenantId || creator.tenantId;
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const entry of MUSIC_CALENDAR_ENTRIES) {
    const title = buildTitle(entry);
    const { start, end, dateKey } = buildEventTimes(entry.month, entry.day, year);
    const dayStart = startOfDayFromKey(dateKey);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existingQuery = {
      title,
      date: { $gte: dayStart, $lt: dayEnd },
    };
    if (scopedTenantId) existingQuery.tenantId = scopedTenantId;

    const existing = await (scopedTenantId
      ? CalendarEvent.findOne(existingQuery)
      : CalendarEvent.findOne(existingQuery).setOptions(BYPASS)
    ).select('_id title tenantId eventType visibility');

    if (existing) {
      const needsPatch = existing.eventType !== 'musical_day'
        || existing.visibility !== 'public'
        || (scopedTenantId && String(existing.tenantId) !== String(scopedTenantId));
      if (needsPatch && !dryRun) {
        await CalendarEvent.updateOne(
          { _id: existing._id },
          {
            $set: {
              eventType: 'musical_day',
              visibility: 'public',
              ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
            },
          }
        ).setOptions(scopedTenantId ? {} : BYPASS);
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (dryRun) {
      created += 1;
      continue;
    }

    await CalendarEvent.create({
      title,
      description: `${SOURCE_TAG} — ${entry.type}: ${entry.name}`,
      date: start,
      endDate: end,
      eventType: 'musical_day',
      visibility: 'public',
      workspace: '',
      projectId: null,
      createdBy: creator._id,
      ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
    });

    created += 1;
  }

  return {
    year,
    total: MUSIC_CALENDAR_ENTRIES.length,
    created,
    updated,
    skipped,
    creator: { id: creator._id, name: creator.name, tenantId: scopedTenantId || creator.tenantId },
  };
}

module.exports = {
  MUSIC_CALENDAR_ENTRIES,
  seedMusicContentCalendar,
};
