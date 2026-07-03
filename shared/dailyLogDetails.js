const { formatTimeSpent, parseTimeSpentToMinutes } = require('./timeSpent');
const { toDateKey } = require('./dateValidation');

const EDIT_WINDOW_DAYS = 14;
const TIMELINE_DAY_START_MIN = 6 * 60;
const TIMELINE_DAY_END_MIN = 22 * 60;

function parseClockToMinutes(timeStr) {
  if (!timeStr || !String(timeStr).includes(':')) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToClock(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function computeIntervalMinutes(startTime, endTime) {
  const start = parseClockToMinutes(startTime);
  const end = parseClockToMinutes(endTime);
  if (start == null || end == null) return 0;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

function computeTimeSpentFromInterval(startTime, endTime) {
  const mins = computeIntervalMinutes(startTime, endTime);
  if (mins <= 0) return '';
  return formatTimeSpent(mins / 60);
}

function normalizeWorkDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

function getLogWorkDateKey(log) {
  const wd = log?.details?.workDate;
  if (wd) {
    const n = normalizeWorkDate(wd);
    if (n) return n;
  }
  return toDateKey(log?.createdAt);
}

function readLogTimeSpentMinutes(log) {
  const d = log?.details || {};
  if (d.startTime && d.endTime) {
    const mins = computeIntervalMinutes(d.startTime, d.endTime);
    if (mins > 0) return mins;
  }
  const raw = d.timeSpent ?? log?.payload?.timeSpent;
  if (raw == null || raw === '') {
    const hours = Number(d.hours);
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
    return 0;
  }
  if (typeof raw === 'number') {
    return raw > 24 ? Math.round(raw) : Math.round(raw * 60);
  }
  return parseTimeSpentToMinutes(raw);
}

function normalizeDailyLogDetails(details = {}) {
  const next = { ...details };
  const workDate = normalizeWorkDate(next.workDate);
  if (workDate) next.workDate = workDate;

  if (next.startTime) next.startTime = String(next.startTime).slice(0, 5);
  if (next.endTime) next.endTime = String(next.endTime).slice(0, 5);

  if (next.startTime && next.endTime) {
    next.timeSpent = computeTimeSpentFromInterval(next.startTime, next.endTime);
  }

  if (Array.isArray(next.memberIds)) {
    next.memberIds = [...new Set(next.memberIds.map(String).filter(Boolean))];
  }

  return next;
}

function isLogEditable(log, { isAdmin = false } = {}) {
  if (isAdmin) return true;
  const workKey = getLogWorkDateKey(log);
  if (!workKey) return false;
  const today = toDateKey(new Date());
  const workDate = new Date(`${workKey}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  const diffDays = Math.floor((todayDate - workDate) / 86400000);
  return diffDays >= 0 && diffDays <= EDIT_WINDOW_DAYS;
}

function buildDailyLogDateRangeFilter(startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const createdAt = {};
  if (start) createdAt.$gte = start;
  if (end) createdAt.$lte = end;

  const startKey = start ? toDateKey(start) : null;
  const endKey = end ? toDateKey(end) : null;

  const clauses = [];
  if (startKey && endKey) {
    clauses.push({ 'details.workDate': { $gte: startKey, $lte: endKey } });
  } else if (startKey) {
    clauses.push({ 'details.workDate': { $gte: startKey } });
  } else if (endKey) {
    clauses.push({ 'details.workDate': { $lte: endKey } });
  }

  if (Object.keys(createdAt).length) {
    clauses.push({
      $and: [
        {
          $or: [
            { 'details.workDate': { $exists: false } },
            { 'details.workDate': null },
            { 'details.workDate': '' },
          ],
        },
        { createdAt },
      ],
    });
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

const TIMELINE_FALLBACK_DURATION_MIN = 30;
const TIMELINE_MIN_BLOCK_MIN = 15;
export const TIMELINE_RANGE_PAD_MIN = 30;

function parseCreatedAtToMinutes(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function resolveLogTimelineBlock(log) {
  const d = log?.details || {};
  const explicitStart = d.startTime ? parseClockToMinutes(d.startTime) : null;
  const explicitEnd = d.endTime ? parseClockToMinutes(d.endTime) : null;

  if (explicitStart != null && explicitEnd != null) {
    let endMin = explicitEnd;
    if (endMin <= explicitStart) endMin += 24 * 60;
    return {
      startMin: explicitStart,
      endMin,
      estimated: false,
    };
  }

  const durationRaw = readLogTimeSpentMinutes(log);
  const durationMin = durationRaw > 0
    ? Math.max(TIMELINE_MIN_BLOCK_MIN, durationRaw)
    : TIMELINE_FALLBACK_DURATION_MIN;

  let startMin = explicitStart;
  let endMin = explicitEnd;

  if (endMin == null) {
    endMin = parseCreatedAtToMinutes(log?.createdAt);
  }
  if (endMin == null) {
    endMin = 12 * 60;
  }

  if (startMin == null) {
    startMin = endMin - durationMin;
    if (startMin < 0) startMin = 0;
  } else if (explicitEnd == null) {
    endMin = startMin + durationMin;
    if (endMin <= startMin) endMin = startMin + durationMin;
  }

  if (endMin <= startMin) {
    endMin = startMin + Math.max(TIMELINE_MIN_BLOCK_MIN, durationMin);
  }

  return { startMin, endMin, estimated: true };
}

function getLogTimelineBounds(logs = []) {
  let firstIn = null;
  let lastOut = null;
  const blocks = [];

  for (const log of logs) {
    const d = log?.details || {};
    const { startMin, endMin, estimated } = resolveLogTimelineBlock(log);
    if (firstIn == null || startMin < firstIn) firstIn = startMin;
    if (lastOut == null || endMin > lastOut) lastOut = endMin;
    blocks.push({
      id: String(log._id),
      title: d.title || 'Work',
      startMin,
      endMin,
      message: d.message || '',
      estimated,
    });
  }

  blocks.sort((a, b) => a.startMin - b.startMin);
  return { firstIn, lastOut, blocks };
}

/** Stack overlapping intervals into lanes so the bar shows every block. */
function assignTimelineLanes(blocks = []) {
  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
  );
  const laneEnds = [];
  const laned = sorted.map((block) => {
    let lane = 0;
    while (laneEnds[lane] != null && laneEnds[lane] > block.startMin) {
      lane += 1;
    }
    laneEnds[lane] = block.endMin;
    return { ...block, lane };
  });
  return { blocks: laned, laneCount: Math.max(1, laneEnds.length) };
}

/** Visible axis for the day bar — follows actual work bounds, not a hard 22:00 cap. */
function computeTimelineDisplayRange({
  firstIn,
  lastOut,
  padMin = TIMELINE_RANGE_PAD_MIN,
} = {}) {
  if (firstIn == null && lastOut == null) {
    return {
      rangeStart: TIMELINE_DAY_START_MIN,
      rangeEnd: TIMELINE_DAY_END_MIN,
      span: TIMELINE_DAY_END_MIN - TIMELINE_DAY_START_MIN,
    };
  }
  const rangeStart = firstIn != null
    ? Math.max(0, firstIn - padMin)
    : TIMELINE_DAY_START_MIN;
  const rangeEnd = lastOut != null
    ? lastOut + padMin
    : TIMELINE_DAY_END_MIN;
  const span = Math.max(60, rangeEnd - rangeStart);
  return { rangeStart, rangeEnd, span };
}

function getLogTimelineDisplay(logs = [], { attendanceInMin, attendanceOutMin } = {}) {
  const { firstIn, lastOut, blocks } = getLogTimelineBounds(logs);
  const inCandidates = [firstIn, attendanceInMin].filter((n) => n != null);
  const outCandidates = [lastOut, attendanceOutMin].filter((n) => n != null);
  const mergedFirst = inCandidates.length ? Math.min(...inCandidates) : null;
  const mergedLast = outCandidates.length ? Math.max(...outCandidates) : null;
  const { blocks: lanedBlocks, laneCount } = assignTimelineLanes(blocks);
  const { rangeStart, rangeEnd, span } = computeTimelineDisplayRange({
    firstIn: mergedFirst,
    lastOut: mergedLast,
  });
  return {
    firstIn: mergedFirst,
    lastOut: mergedLast,
    blocks: lanedBlocks,
    laneCount,
    rangeStart,
    rangeEnd,
    span,
  };
}

module.exports = {
  EDIT_WINDOW_DAYS,
  TIMELINE_DAY_START_MIN,
  TIMELINE_DAY_END_MIN,
  parseClockToMinutes,
  minutesToClock,
  computeIntervalMinutes,
  computeTimeSpentFromInterval,
  normalizeWorkDate,
  getLogWorkDateKey,
  readLogTimeSpentMinutes,
  normalizeDailyLogDetails,
  isLogEditable,
  buildDailyLogDateRangeFilter,
  getLogTimelineBounds,
  assignTimelineLanes,
  computeTimelineDisplayRange,
  getLogTimelineDisplay,
  TIMELINE_RANGE_PAD_MIN,
};
