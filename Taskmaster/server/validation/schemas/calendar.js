const { z } = require('zod');
const { isSafePrimitive } = require('./safeValues');

const calendarQuery = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const calendarEventBody = z.record(z.unknown()).refine(
  (body) => Object.values(body).every(isSafePrimitive),
  { message: 'Invalid input format' },
);

module.exports = {
  calendarQuery,
  calendarEventBody,
};
