const { APP_TIMEZONE } = require('./attendanceDate');
const {
  getTodayDateKey,
  toDateKey,
  validateTaskTimelineFields,
  validateCalendarEventRange: validateCalendarEventRangeShared,
} = require('../../shared/dateValidation');

const TZ_OFFSETS = {
  'Asia/Kolkata': '+05:30',
  UTC: '+00:00',
};

const getTzOffset = () => TZ_OFFSETS[APP_TIMEZONE] || '+05:30';

const validateCalendarEventRange = (payload) => validateCalendarEventRangeShared(payload, {
  timeZone: APP_TIMEZONE,
  tzOffset: getTzOffset(),
});

const validateTaskTimelineForRequest = (fields) => validateTaskTimelineFields(fields, APP_TIMEZONE);

const getAppTodayDateKey = () => getTodayDateKey(APP_TIMEZONE);

module.exports = {
  validateTaskTimelineForRequest,
  validateCalendarEventRange,
  getAppTodayDateKey,
  toDateKey,
};
