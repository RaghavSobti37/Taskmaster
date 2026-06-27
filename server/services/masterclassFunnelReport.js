const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const Lead = require('../models/Lead');
const { parseOfferingTitle } = require('../utils/exlyUtils');
const { computeBookingBreakdown } = require('../utils/exlyMetrics');
const {
  shortCourseName,
  shortMentorName,
  mapLeadToCourseEnrollment,
  aggregateCourseEnrollments,
} = require('../utils/exlyCourseLabels');

const MASTERCLASS_RE = /masterclass|master class|webinar|workshop|live session|jamming|artist path/i;
const COURSE_RE = /course|core tribe|program|academy|comprehensive/i;

function isMasterclassOffering(off, sampleBooking) {
  const type = String(off?.type || sampleBooking?.offeringType || '').toLowerCase();
  const title = String(off?.title || sampleBooking?.offeringTitle || '');
  if (type.includes('masterclass') || type.includes('webinar')) return true;
  return MASTERCLASS_RE.test(title) && !COURSE_RE.test(title.replace(/masterclass/gi, ''));
}

function mentorFromTitle(title) {
  const { cleanTitle } = parseOfferingTitle(title);
  const trimName = (raw) => raw.split(/\s*-\s*/)[0].trim();
  const byMatch = cleanTitle.match(/\bby\s+([A-Za-z .'-]{3,50})/i);
  if (byMatch) return trimName(byMatch[1]);
  const withMatch = cleanTitle.match(/\bwith\s+([A-Za-z .'-]{3,50})/i);
  if (withMatch) return trimName(withMatch[1]);
  return '';
}

function masterclassName(title) {
  const { cleanTitle } = parseOfferingTitle(title);
  return cleanTitle
    .replace(/\s*-\s*Live Masterclass.*/i, '')
    .replace(/\s*-\s*Exclusive Live Masterclass.*/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim() || title;
}

function sessionWhen(off, dateStr, timeStr) {
  if (dateStr && timeStr) return `${dateStr} · ${timeStr}`;
  if (dateStr) return dateStr;
  if (off.eventDate || off.eventTime) {
    return [off.eventDate, off.eventTime].filter(Boolean).join(' · ');
  }
  return 'Session';
}

function courseLabel(lead) {
  return shortCourseName(lead.exlyOfferingTitle || lead.source || 'TSC Program');
}

function bookingKey(email, phone) {
  return `${(email || '').toLowerCase()}|${phone || ''}`;
}

async function convertedFromCohort(offeringId, title, bookings, sessionMentor) {
  const keys = new Set(bookings.map((b) => bookingKey(b.email, b.phone)));

  const leads = await Lead.find({
    leadStatus: 'Converted',
    $or: [
      { exlyOfferingId: offeringId },
      { exlyOfferingTitle: title },
      { source: title },
      { 'exlyOfferings.offeringId': offeringId },
    ],
  })
    .select('name email phone planOption exlyOfferingTitle source metadata')
    .lean();

  const matched = leads.filter((l) => keys.has(bookingKey(l.email, l.phone)));
  const students = matched.map((l) => mapLeadToCourseEnrollment(l, sessionMentor));

  return {
    count: matched.length,
    students,
    courses: aggregateCourseEnrollments(students),
  };
}

async function buildMasterclassFunnelReport() {
  const offerings = await ExlyOffering.find({}).lean();
  const bookingSample = await ExlyBooking.aggregate([
    { $group: { _id: '$offeringId', sample: { $first: '$$ROOT' } } },
  ]);
  const sampleByOffering = new Map(bookingSample.map((r) => [r._id, r.sample]));

  const sessions = [];
  for (const off of offerings) {
    const sample = sampleByOffering.get(off.offeringId);
    if (!isMasterclassOffering(off, sample)) continue;

    const bookings = await ExlyBooking.find({ offeringId: off.offeringId })
      .sort({ bookedOn: -1 })
      .lean();
    if (!bookings.length) continue;

    const breakdown = computeBookingBreakdown(bookings);
    const { dateStr, timeStr } = parseOfferingTitle(off.title);
    const mentor = mentorFromTitle(off.title) || mentorFromTitle(sample?.offeringTitle || '');
    const conv = await convertedFromCohort(off.offeringId, off.title, bookings, mentor);

    sessions.push({
      masterclass: masterclassName(off.title),
      sessionLabel: sessionWhen(off, dateStr, timeStr),
      sessionDate: off.eventDate || dateStr || '',
      sessionTime: off.eventTime || timeStr || '',
      mentor: mentor || 'TSC Faculty',
      mentorShort: shortMentorName(mentor) || 'TSC',
      registrations: breakdown.totalBookings,
      paidRegistrations: breakdown.paidBookings,
      freeRegistrations: breakdown.freeBookings,
      masterclassRevenue: breakdown.totalRevenue,
      courseEnrollments: conv.count,
      conversionRate: breakdown.totalBookings
        ? Number(((conv.count / breakdown.totalBookings) * 100).toFixed(1))
        : 0,
      coursesEnrolled: conv.courses,
      students: conv.students,
      exlyOfferingId: off.offeringId,
      exlyTitle: off.title,
    });
  }

  sessions.sort((a, b) => b.registrations - a.registrations || b.courseEnrollments - a.courseEnrollments);

  const totals = sessions.reduce(
    (acc, s) => {
      acc.registrations += s.registrations;
      acc.courseEnrollments += s.courseEnrollments;
      acc.revenue += s.masterclassRevenue;
      return acc;
    },
    { registrations: 0, courseEnrollments: 0, revenue: 0 },
  );

  const withConv = sessions.filter((s) => s.courseEnrollments > 0);
  const convCounts = withConv.map((s) => s.courseEnrollments).sort((a, b) => a - b);
  const median = convCounts.length ? convCounts[Math.floor(convCounts.length / 2)] : 0;
  const avg = convCounts.length
    ? Number((convCounts.reduce((a, b) => a + b, 0) / convCounts.length).toFixed(1))
    : 0;

  const byTheme = new Map();
  for (const s of sessions) {
    const key = s.masterclass;
    const cur = byTheme.get(key) || {
      masterclass: key,
      mentor: s.mentor,
      sessions: 0,
      registrations: 0,
      courseEnrollments: 0,
    };
    cur.sessions += 1;
    cur.registrations += s.registrations;
    cur.courseEnrollments += s.courseEnrollments;
    if (cur.mentor === 'TSC Faculty' && s.mentor !== 'TSC Faculty') cur.mentor = s.mentor;
    byTheme.set(key, cur);
  }
  const themes = [...byTheme.values()]
    .map((t) => ({
      ...t,
      conversionRate: t.registrations
        ? Number(((t.courseEnrollments / t.registrations) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.registrations - a.registrations);

  return {
    generatedAt: new Date().toISOString(),
    dataLegend: {
      registrations: 'Exly sign-ups for this live masterclass (Sandesh or Prasad session)',
      courseEnrollments: 'Same person marked Converted in CRM — matched by email/phone',
      courseName: 'Short program name (e.g. Core Tribe) — not the full Exly offering title',
      price: 'Deal value or plan at conversion (₹ amount they paid)',
      mentor: 'Faculty who hosted this masterclass — maps to course funnel cohort',
    },
    summary: {
      masterclassSessions: sessions.length,
      totalRegistrations: totals.registrations,
      totalCourseEnrollments: totals.courseEnrollments,
      overallConversionRate: totals.registrations
        ? Number(((totals.courseEnrollments / totals.registrations) * 100).toFixed(1))
        : 0,
      sessionsWithEnrollments: withConv.length,
      medianEnrollmentsPerSession: median,
      avgEnrollmentsPerSession: avg,
      masterclassTicketRevenue: totals.revenue,
    },
    themes,
    sessions,
  };
}

module.exports = {
  buildMasterclassFunnelReport,
  isMasterclassOffering,
  masterclassName,
  mentorFromTitle,
  courseLabel,
};
