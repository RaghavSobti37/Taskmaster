/**
 * CoreKnot gamification — single source of truth for XP amounts, caps, and rule copy.
 * Admin-editable values live in GamificationConfig; these are defaults + fairness rules.
 */

/** Actions where config value = XP earned per hour of time logged. */
const TIME_BASED_XP_ACTIONS = new Set(['COMPLETE_TASK', 'DAILY_LOG', 'ATTENDANCE_ACTION']);

/** Max hours credited toward XP for a single time-based award (anti-inflation). */
const MAX_XP_HOURS_PER_EVENT = 12;

/** Manual daily log: first N hours at base rate; hours above earn overtime rate (1.5× base by default). */
const DAILY_LOG_OVERTIME_THRESHOLD_HOURS = 8;
const DAILY_LOG_OVERTIME_RATE_MULTIPLIER = 1.5;

/** XP per hour of time for time-based actions; flat XP for all others (overridden by GamificationConfig). */
const DEFAULT_XP = {
  taskCompletion: 15,
  dailyLog: 10,
  taskCreation: 2,
  projectCreation: 5,
  attendanceLog: 10,
  attendanceDayBonus: 5,
  assetUpload: 12,
  leadCapture: 15,
  invoiceSubmission: 15,
  reviewApproval: 8,
  calendarEventCreated: 2,
  announcementCreated: 0,
  leaveApplied: 0,
  dailyMissionBaseReward: 25,
  stepXp: 100,
  baseXp: 100,
};

/** Max times per action per user per calendar day (IST). null = unlimited. */
const DEFAULT_DAILY_CAPS = {
  taskCompletion: null,
  dailyLog: 5,
  taskCreation: 10,
  projectCreation: 3,
  attendanceLog: 1,
  attendanceDayBonus: 1,
  assetUpload: 5,
  leadCapture: 10,
  invoiceSubmission: 5,
  reviewApproval: 15,
  calendarEventCreated: 3,
  announcementCreated: 0,
  leaveApplied: 0,
};

/** Legacy audit-log action codes → canonical action (for recalc + leaderboard). */
const LEGACY_ACTION_ALIASES = {
  TASK_COMPLETED: 'COMPLETE_TASK',
  ATTENDANCE_CHECKIN_WINDOW: 'ATTENDANCE_ACTION',
  ATTENDANCE_CHECKOUT_WINDOW: 'ATTENDANCE_ACTION',
};

const normalizeGamificationAction = (action) => LEGACY_ACTION_ALIASES[action] || action;

const isTimeBasedXpAction = (action) =>
  TIME_BASED_XP_ACTIONS.has(normalizeGamificationAction(action));

/** @param {number} hours decimal hours worked
 * @param {number} xpPerHour config rate
 * @returns {number} rounded XP (0 if no time or rate) */
const clampXpHours = (hours) => {
  const h = Number(hours) || 0;
  if (h <= 0) return 0;
  return Math.min(h, MAX_XP_HOURS_PER_EVENT);
};

const computeTimeBasedXp = (hours, xpPerHour) => {
  const h = clampXpHours(hours);
  const rate = Number(xpPerHour) || 0;
  if (h <= 0 || rate <= 0) return 0;
  return Math.round(h * rate);
};

const resolveManualDailyLogOvertimeRate = (plain = {}) => {
  if (plain.dailyLogOvertime != null) return Number(plain.dailyLogOvertime) || 0;
  const base = Number(plain.dailyLog ?? DEFAULT_XP.dailyLog) || 0;
  return Math.round(base * DAILY_LOG_OVERTIME_RATE_MULTIPLIER);
};

/** Manual daily log XP only — not used for task completion or attendance. */
const computeManualDailyLogXp = (hours, xpPerHour, overtimeXpPerHour) => {
  const h = clampXpHours(hours);
  const rate = Number(xpPerHour) || 0;
  const otRate = Number(overtimeXpPerHour) || rate;
  if (h <= 0 || rate <= 0) return 0;
  const standardH = Math.min(h, DAILY_LOG_OVERTIME_THRESHOLD_HOURS);
  const overtimeH = Math.max(0, h - DAILY_LOG_OVERTIME_THRESHOLD_HOURS);
  return computeTimeBasedXp(standardH, rate) + computeTimeBasedXp(overtimeH, otRate);
};

/** Maps internal action codes → GamificationConfig field names. */
const ACTION_CONFIG_KEY = {
  COMPLETE_TASK: 'taskCompletion',
  CREATE_TASK: 'taskCreation',
  CREATE_PROJECT: 'projectCreation',
  DAILY_LOG: 'dailyLog',
  ATTENDANCE_ACTION: 'attendanceLog',
  ATTENDANCE_DAY_BONUS: 'attendanceDayBonus',
  LEAVE_APPLIED: 'leaveApplied',
  CALENDAR_EVENT_CREATED: 'calendarEventCreated',
  ANNOUNCEMENT_CREATED: 'announcementCreated',
  REVIEW_APPROVAL: 'reviewApproval',
  ASSET_UPLOAD: 'assetUpload',
  LEAD_CAPTURE: 'leadCapture',
  INVOICE_SUBMISSION: 'invoiceSubmission',
  MISSION_COMPLETE: null,
};

const ACTION_LABELS = {
  COMPLETE_TASK: 'Completed a task',
  CREATE_TASK: 'Created a task',
  CREATE_PROJECT: 'Created a project',
  DAILY_LOG: 'Manual daily log',
  ATTENDANCE_ACTION: 'Full-day attendance',
  ATTENDANCE_DAY_BONUS: 'Attendance + logs aligned',
  LEAVE_APPLIED: 'Applied leave',
  CALENDAR_EVENT_CREATED: 'Created calendar event',
  ANNOUNCEMENT_CREATED: 'Created announcement',
  REVIEW_APPROVAL: 'Approved a review',
  ASSET_UPLOAD: 'Uploaded project asset',
  LEAD_CAPTURE: 'Captured a lead',
  INVOICE_SUBMISSION: 'Submitted invoice',
  MISSION_COMPLETE: 'Daily mission bonus',
  XP_RECALC_ADJUSTMENT: 'XP recalculated',
};

/** Shown in progress history after admin recalc; earns 0 XP. */
const RECALC_HISTORY_ACTIONS = new Set(['XP_RECALC_ADJUSTMENT']);

/** Daily missions — bonus XP on top of action XP. */
const DAILY_MISSIONS = [
  {
    title: 'Task Conqueror',
    description: 'Complete 3 tasks today',
    targetCount: 3,
    actionType: 'COMPLETE_TASK',
    expReward: 25,
  },
  {
    title: 'Time Tracker',
    description: 'Add 2 manual daily logs today',
    targetCount: 2,
    actionType: 'DAILY_LOG',
    expReward: 20,
  },
  {
    title: 'Full Day',
    description: 'Complete check-in and check-out today',
    targetCount: 1,
    actionType: 'ATTENDANCE_DAY',
    expReward: 15,
  },
];

const FAIRNESS_PRINCIPLES = [
  'Outcome over setup — completing work earns more than creating tasks or projects.',
  'Role-balanced paths — sales (leads), creatives (tasks + assets), ops (attendance + invoices), reviewers (approvals) can all climb the board.',
  'Daily caps on low-effort actions stop admins and managers from spamming the leaderboard.',
  'Task completion XP is once per task per person — no farming the same item.',
  'Auto daily logs from task completion do not grant log XP — task completion XP uses hours × XP/hour instead.',
  'Manual daily logs: up to 5 awards per day (task auto-logs excluded); first 8h × rate, hours above 8 at 1.5× rate (max 12h per log). Task completion = hours × rate. Full-day attendance XP = once per day after ops locks both check-in and check-out.',
  'Weekly leaderboard uses audit log totals — everyone starts fresh each week.',
];

const ROLE_PATHS = [
  { role: 'Individual contributor', actions: 'Complete tasks (hours × XP/h), manual daily logs (8h base + overtime, max 5/day)', weeklyPotential: 'Scales with time logged' },
  { role: 'Sales / CRM', actions: 'Capture leads (+15 flat, max 10/day), follow-up work logged as daily logs (hours × XP/h)', weeklyPotential: 'Scales with time logged' },
  { role: 'Creative / production', actions: 'Complete tasks (hours × XP/h), upload assets (+12 flat, max 5/day)', weeklyPotential: 'Scales with time logged' },
  { role: 'Ops / finance', actions: 'Full-day attendance (hours × XP/h), invoice submissions (+15), review approvals (+8)', weeklyPotential: 'Scales with time logged' },
  { role: 'Managers / admins', actions: 'Lower XP for creating projects (+5, cap 3/day) and tasks (+2, cap 10/day); main earn path is completing and reviewing work', weeklyPotential: 'Same caps — cannot outrank ICs by setup alone' },
];

/** Admin UI rule rows — configKey links to editable GamificationConfig field. */
const XP_RULE_ROWS = [
  { configKey: 'taskCompletion', action: 'COMPLETE_TASK', label: 'Task completion', capKey: 'taskCompletion', who: 'Assignee when task reaches Done', note: 'XP per hour — actualHours on the task × rate (min 30m if unset)' },
  { configKey: 'dailyLog', action: 'DAILY_LOG', label: 'Manual daily log', capKey: 'dailyLog', who: 'Anyone logging time manually', note: 'First 8h × rate, hours above 8 at 1.5× rate; max 5 manual awards/day — task auto-logs do not count' },
  { configKey: 'taskCreation', action: 'CREATE_TASK', label: 'Task creation', capKey: 'taskCreation', who: 'Creator', note: 'Low — prevents manager spam' },
  { configKey: 'projectCreation', action: 'CREATE_PROJECT', label: 'Project creation', capKey: 'projectCreation', who: 'Creator', note: 'Low — prevents admin spam' },
  { configKey: 'attendanceLog', action: 'ATTENDANCE_ACTION', label: 'Full-day attendance', capKey: 'attendanceLog', who: 'User with check-in + check-out', note: 'XP per hour (system shift) — once per day, only after ops approves both IN and OUT' },
  { configKey: 'attendanceDayBonus', action: 'ATTENDANCE_DAY_BONUS', label: 'Attendance accuracy bonus', capKey: 'attendanceDayBonus', who: '8h+ shift with logs within 30 min of attendance', note: 'Awarded with full-day XP when day is admin-locked' },
  { configKey: 'assetUpload', action: 'ASSET_UPLOAD', label: 'Asset upload', capKey: 'assetUpload', who: 'Uploader', note: 'Creative / production path' },
  { configKey: 'leadCapture', action: 'LEAD_CAPTURE', label: 'Lead capture', capKey: 'leadCapture', who: 'Rep creating a new lead manually', note: 'Sales path — not webhook imports' },
  { configKey: 'invoiceSubmission', action: 'INVOICE_SUBMISSION', label: 'Invoice submission', capKey: 'invoiceSubmission', who: 'Submitter', note: 'Finance / ops path' },
  { configKey: 'reviewApproval', action: 'REVIEW_APPROVAL', label: 'Review approval', capKey: 'reviewApproval', who: 'Reviewer approving in-review task', note: 'Rewards managers without task hoarding' },
  { configKey: 'calendarEventCreated', action: 'CALENDAR_EVENT_CREATED', label: 'Calendar event', capKey: 'calendarEventCreated', who: 'Event creator', note: 'Minor — optional' },
  { configKey: 'announcementCreated', action: 'ANNOUNCEMENT_CREATED', label: 'Announcement', capKey: 'announcementCreated', who: 'Author', note: 'Disabled by default (0 XP)' },
  { configKey: 'leaveApplied', action: 'LEAVE_APPLIED', label: 'Leave application', capKey: 'leaveApplied', who: '—', note: 'Disabled (0 XP)' },
];

const NO_XP_ACTIONS = [
  'Viewing dashboard, projects, todo, or inbox',
  'Editing or deleting tasks, logs, or projects',
  'Submitting a task for review (in-review) — completion XP on approve/done only',
  'Receiving notifications or @mentions',
  'Auto daily logs from task completion',
  'Webhook / import lead sync (Exly, forms)',
  'Undo attendance check-in/out',
  'Reading announcements or calendar events',
];

module.exports = {
  DEFAULT_XP,
  DEFAULT_DAILY_CAPS,
  TIME_BASED_XP_ACTIONS,
  RECALC_HISTORY_ACTIONS,
  LEGACY_ACTION_ALIASES,
  normalizeGamificationAction,
  isTimeBasedXpAction,
  computeTimeBasedXp,
  clampXpHours,
  computeManualDailyLogXp,
  resolveManualDailyLogOvertimeRate,
  DAILY_LOG_OVERTIME_THRESHOLD_HOURS,
  MAX_XP_HOURS_PER_EVENT,
  ACTION_CONFIG_KEY,
  ACTION_LABELS,
  DAILY_MISSIONS,
  FAIRNESS_PRINCIPLES,
  ROLE_PATHS,
  XP_RULE_ROWS,
  NO_XP_ACTIONS,
};
