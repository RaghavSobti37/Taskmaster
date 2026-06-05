const { z } = require('zod');
const { isSafeShallowRecord } = require('./safeValues');

const runAdminScriptBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([, value]) => isSafeShallowRecord(value) || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
  { message: 'Invalid input format' },
);

const adminScriptParams = z.object({
  scriptId: z.string().min(1),
});

module.exports = {
  runAdminScriptBody,
  adminScriptParams,
};
