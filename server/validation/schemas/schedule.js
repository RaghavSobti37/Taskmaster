const { z } = require('zod');

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const scheduleQuery = z.object({
  start: dateKey,
  end: dateKey,
  projectId: z.string().optional(),
  departmentId: z.string().optional(),
});

module.exports = {
  scheduleQuery,
};
