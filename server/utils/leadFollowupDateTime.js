const { parse } = require('date-fns');

function parseLeadFollowupDateTime(lead) {
  const dateStr = String(lead?.nextFollowupDate || '').trim();
  if (!dateStr) return null;

  const timeStr = String(lead?.nextFollowupTime || '').trim();
  if (timeStr) {
    const with24h = parse(`${dateStr} ${timeStr}`, 'dd-MM-yyyy HH:mm', new Date());
    if (!Number.isNaN(with24h.getTime())) return with24h;
    const with12h = parse(`${dateStr} ${timeStr}`, 'dd-MM-yyyy h:mm a', new Date());
    if (!Number.isNaN(with12h.getTime())) return with12h;
  }

  const dateOnly = parse(dateStr, 'dd-MM-yyyy', new Date());
  return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
}

function formatFollowupScheduleLabel(lead) {
  const dateStr = String(lead?.nextFollowupDate || '').trim();
  const timeStr = String(lead?.nextFollowupTime || '').trim();
  if (!dateStr) return 'scheduled time';
  return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
}

module.exports = {
  parseLeadFollowupDateTime,
  formatFollowupScheduleLabel,
};
