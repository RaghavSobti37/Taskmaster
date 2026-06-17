const { z } = require('zod');
const { isSafeShallowRecord } = require('./safeValues');

const runAdminScriptBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([, value]) => isSafeShallowRecord(value) || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
  { message: 'Invalid input format' },
);

const adminScriptParams = z.object({
  scriptId: z.string().min(1),
});

const sendCrmReachOutDigestBody = z.object({
  to: z.string().email().optional(),
  days: z.coerce.number().int().min(1).max(30).optional(),
  dryRun: z.boolean().optional(),
});

module.exports = {
  runAdminScriptBody,
  adminScriptParams,
  sendCrmReachOutDigestBody,
};
