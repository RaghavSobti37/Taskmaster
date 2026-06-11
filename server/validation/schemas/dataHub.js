const { z } = require('zod');

const numericString = z.string().regex(/^\d+$/).optional();

const dataHubPeopleQuery = z.object({
  page: numericString,
  limit: numericString,
  folder: z.string().optional(),
  search: z.string().optional(),
  campaign: z.string().optional(),
  originSource: z.string().optional(),
  emailStatus: z.string().optional(),
  sort: z.enum(['lastActivity', 'updated', 'name']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const dataHubPersonQuery = z.object({
  section: z.string().optional(),
  full: z.enum(['true', 'false', '1', '0']).optional(),
});

const dataHubAnalyticsQuery = z.object({
  folder: z.string().optional(),
});

const dataHubReconcileQuery = z.object({
  full: z.enum(['true', 'false', '1', '0']).optional(),
});

const dataHubBackupQuery = z.object({
  notify: z.enum(['true', 'false']).optional(),
});

module.exports = {
  dataHubPeopleQuery,
  dataHubPersonQuery,
  dataHubAnalyticsQuery,
  dataHubReconcileQuery,
  dataHubBackupQuery,
};
