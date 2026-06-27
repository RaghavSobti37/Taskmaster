/**
 * Polyglot hybrid architecture — canonical entity → store registry.
 * Shared by Express, NestJS ETL, and BullMQ domain-sync handlers.
 *
 * Phase 1: Mongo primary writes; Supabase target for structured domains;
 * Redis for cache keys only. Do not route locked MailEvent writes to Supabase.
 */

const STORE = Object.freeze({
  SUPABASE: 'supabase',
  MONGO: 'mongo',
  REDIS: 'redis',
});

/** Structured system-of-record entities (Supabase PostgreSQL target). */
const SUPABASE_ENTITIES = Object.freeze([
  'Tenant',
  'User',
  'Department',
  'Team',
  'Workspace',
  'Project',
  'Phase',
  'Task',
  'TaskAssignment',
  'TaskType',
  'TaskMentionReceipt',
  'TaskDependency',
  'TaskMentionAccess',
  'Person',
  'PersonIdentifier',
  'PersonSourceLink',
  'PersonCommunicationProfile',
  'PersonHubView',
  'Lead',
  'LeadNote',
  'LeadExlyOffering',
  'CRMConfig',
  'CRMImport',
  'EMI',
  'BookedCall',
  'Attendance',
  'LeaveRequest',
  'GamificationConfig',
  'DailyMission',
  'Notification',
  'DashboardPreset',
  'FinanceDocument',
  'Subscription',
  'MailTemplate',
  'Campaign',
  'CampaignRecipient',
  'EmailProfile',
  'ProjectGoal',
  'ProjectGoalSnapshot',
  'ProjectKRA',
  'OrgAccount',
  'Asset',
  'OfficeAsset',
]);

/**
 * Flexible / high-churn / blob / locked-schema entities (Mongo retention).
 * MailEvent schema is LOCKED — never add Supabase migration stubs for it.
 */
const MONGO_ENTITIES = Object.freeze([
  'MailEvent',
  'EmailLog',
  'MailCampaign',
  'MailCampaignRecipient',
  'TaskActivity',
  'Log',
  'SystemLog',
  'CRMAudit',
  'XPAuditLog',
  'Artist',
  'ArtistMetrics',
  'ArtistAuth',
  'ArtistConnection',
  'ArtistPathResponse',
  'CRMStatSnapshot',
  'QATestRun',
  'DataHubSyncState',
  'PersonIndex',
  'TscData',
  'MetaDeletionRequest',
  'NewsletterArticle',
  'NewsletterIssue',
  'NewsletterSubscriber',
  'CalendarEvent',
  'Contact',
  'OfficeContact',
  'ExlyOffering',
  'ExlyBooking',
  'OutsourcedRecord',
  'MasterclassReview',
  'PlatformSettings',
  'WorkspacePreference',
  'ShortcutPreference',
  'Announcement',
  'PinBoardNote',
  'UserNote',
  'WebhookPayload',
  'RawImport',
  'EnrichmentBlob',
  'SocialSnapshot',
  'AiContent',
]);

/** Redis cache key patterns (not entity storage). */
const REDIS_CACHE_KEYS = Object.freeze({
  FOLLOWUPS_REP: 'followups:rep:{repId}',
  FOLLOWUPS_GLOBAL: 'followups:global',
  DASHBOARD_METRICS: 'dashboard:metrics:{userId}',
  CRM_STATS: 'crm:stats:{tenantId}',
  LEADERBOARD: 'leaderboard:week:{weekKey}',
  NOTIFICATION_COUNTS: 'notifications:counts:{userId}',
  ATTENDANCE_STATS: 'attendance:stats:{userId}:{rangeKey}',
  TASK_LIST_COUNTS: 'tasks:counts:{tenantId}:{userId}:{scopeKey}',
  SESSION: 'session:{sessionId}',
});

/** Domain-sync event types (BullMQ domain-sync queue). */
const DOMAIN_SYNC_EVENT_TYPES = Object.freeze([
  'task.created',
  'task.updated',
  'task.deleted',
  'task.activity',
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'attendance.checked',
  'attendance.updated',
  'user.updated',
  'person.merged',
  'notification.created',
  'project.updated',
]);

/** Prisma / PostgREST table name overrides (default: entity name). */
const SUPABASE_TABLE_MAP = Object.freeze({
  Task: 'Task',
  User: 'User',
  Lead: 'Lead',
  Attendance: 'Attendance',
});

const supabaseSet = new Set(SUPABASE_ENTITIES);
const mongoSet = new Set(MONGO_ENTITIES);

function normalizeEntityName(entityName) {
  return String(entityName || '').trim();
}

/**
 * Primary persistence store for an entity at target architecture.
 * @returns {'supabase'|'mongo'|null}
 */
function getStoreForEntity(entityName) {
  const name = normalizeEntityName(entityName);
  if (!name) return null;
  if (mongoSet.has(name)) return STORE.MONGO;
  if (supabaseSet.has(name)) return STORE.SUPABASE;
  return null;
}

function isMongoEntity(entityName) {
  return getStoreForEntity(entityName) === STORE.MONGO;
}

function isSupabaseEntity(entityName) {
  return getStoreForEntity(entityName) === STORE.SUPABASE;
}

function isLockedMongoEntity(entityName) {
  const locked = new Set(['MailEvent']);
  return locked.has(normalizeEntityName(entityName));
}

function getSupabaseTableForEntity(entityName) {
  const name = normalizeEntityName(entityName);
  return SUPABASE_TABLE_MAP[name] || name;
}

function parseEventType(eventType) {
  const parts = String(eventType || '').split('.');
  if (parts.length < 2) return { domain: null, action: null, entity: null };
  const domain = parts[0];
  const action = parts.slice(1).join('.');
  const entity = domain.charAt(0).toUpperCase() + domain.slice(1);
  return { domain, action, entity };
}

function getSyncTargetForEvent(eventType) {
  const { entity } = parseEventType(eventType);
  if (!entity) return null;
  if (eventType === 'task.activity') return STORE.MONGO;
  return getStoreForEntity(entity);
}

module.exports = {
  STORE,
  SUPABASE_ENTITIES,
  MONGO_ENTITIES,
  REDIS_CACHE_KEYS,
  DOMAIN_SYNC_EVENT_TYPES,
  SUPABASE_TABLE_MAP,
  getStoreForEntity,
  isMongoEntity,
  isSupabaseEntity,
  isLockedMongoEntity,
  getSupabaseTableForEntity,
  parseEventType,
  getSyncTargetForEvent,
};
