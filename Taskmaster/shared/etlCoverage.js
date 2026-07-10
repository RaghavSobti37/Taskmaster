/**
 * ETL coverage manifest — maps SUPABASE_ENTITIES to mongo-to-postgres collection keys.
 * Used by migration:readiness and etl:validate-counts.
 */

const { SUPABASE_ENTITIES } = require('./dataOwnership');

/** Entity → ETL collection key(s). Flattened rows use synthetic keys. */
const ETL_ENTITY_MAP = Object.freeze({
  Tenant: ['tenants'],
  User: ['users'],
  Department: ['departments'],
  Team: ['teams'],
  Workspace: ['workspaces'],
  Project: ['projects', 'projectmembers'],
  Phase: ['phases'],
  Task: ['tasks', 'taskdependencies', 'taskmentionaccess'],
  TaskAssignment: ['taskassignments'],
  TaskType: ['tasktypes'],
  TaskMentionReceipt: [],
  TaskDependency: ['taskdependencies'],
  TaskMentionAccess: ['taskmentionaccess'],
  Person: ['persons'],
  PersonIdentifier: ['personidentifiers'],
  PersonSourceLink: [],
  PersonCommunicationProfile: [],
  PersonHubView: [],
  Lead: ['leads', 'leadnotes', 'leadexlyofferings'],
  LeadNote: ['leadnotes'],
  LeadExlyOffering: ['leadexlyofferings'],
  CRMConfig: ['crmconfigs'],
  CRMImport: ['crmimports'],
  EMI: [],
  BookedCall: [],
  Attendance: ['attendance'],
  LeaveRequest: ['leaverequests'],
  GamificationConfig: ['gamificationconfigs'],
  DailyMission: [],
  Notification: ['notifications'],
  DashboardPreset: [],
  FinanceDocument: [],
  Subscription: [],
  MailTemplate: [],
  Campaign: [],
  CampaignRecipient: [],
  EmailProfile: [],
  ProjectGoal: ['projectgoals'],
  ProjectGoalSnapshot: [],
  ProjectKRA: [],
  OrgAccount: [],
  Asset: [],
  OfficeAsset: [],
});

/** Tier-4 cold archive — optional for preview ETL; MailEvent stays Mongo in prod until unlock. */
const ETL_TIER4_OPTIONAL = Object.freeze(['taskactivities', 'mailevents']);

/** Entities intentionally deferred past initial Postgres cutover. */
const DEFERRED_ENTITIES = Object.freeze(
  SUPABASE_ENTITIES.filter((entity) => {
    const keys = ETL_ENTITY_MAP[entity];
    return !keys || keys.length === 0;
  }),
);

/** Required for strangler flip (attendance + operational reads). */
const REQUIRED_FOR_CUTOVER = Object.freeze(
  SUPABASE_ENTITIES.filter((entity) => {
    const keys = ETL_ENTITY_MAP[entity];
    return Array.isArray(keys) && keys.length > 0;
  }),
);

/** All ETL collection keys (including flatten synthetic keys). */
const ALL_ETL_KEYS = Object.freeze(
  [...new Set(Object.values(ETL_ENTITY_MAP).flat())].sort(),
);

function getEtlKeysForEntity(entityName) {
  return ETL_ENTITY_MAP[entityName] || [];
}

function isEntityCoveredForCutover(entityName) {
  const keys = getEtlKeysForEntity(entityName);
  return keys.length > 0;
}

module.exports = {
  ETL_ENTITY_MAP,
  ETL_TIER4_OPTIONAL,
  DEFERRED_ENTITIES,
  REQUIRED_FOR_CUTOVER,
  ALL_ETL_KEYS,
  getEtlKeysForEntity,
  isEntityCoveredForCutover,
};
