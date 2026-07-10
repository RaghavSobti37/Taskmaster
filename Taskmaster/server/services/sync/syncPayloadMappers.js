/**
 * Map Mongo-shaped domain payloads → Supabase/PostgREST row shapes for domain-sync.
 */

function normalizeId(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function toIsoDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toJson(value) {
  if (value === undefined || value === null) return null;
  return value;
}

function mapTaskRow(payload = {}) {
  const id = normalizeId(payload.id || payload._id);
  if (!id) return null;
  return {
    id,
    tenantId: normalizeId(payload.tenantId),
    title: String(payload.title || ''),
    description: payload.description ?? null,
    status: String(payload.status || 'todo').toLowerCase(),
    priority: payload.priority || 'medium',
    type: payload.type || '',
    scheduleSlot: payload.scheduleSlot || 'FULL',
    scheduleDate: toIsoDate(payload.scheduleDate),
    notifiedWarning: Boolean(payload.notifiedWarning),
    projectId: normalizeId(payload.projectId),
    workspace: payload.workspace || 'General',
    phaseId: normalizeId(payload.phaseId),
    parentTaskId: normalizeId(payload.parentTaskId),
    startDate: toIsoDate(payload.startDate),
    dueDate: toIsoDate(payload.dueDate),
    duration: payload.duration == null ? null : Number(payload.duration),
    plannedHours: Number(payload.plannedHours) || 0,
    actualHours: Number(payload.actualHours) || 0,
    progress: Number(payload.progress) || 0,
    completedAt: toIsoDate(payload.completedAt),
    dependencies: Array.isArray(payload.dependencies)
      ? payload.dependencies.map(normalizeId).filter(Boolean)
      : [],
    createdById: normalizeId(payload.createdById || payload.createdBy),
    mentionAccessIds: Array.isArray(payload.mentionAccessIds)
      ? payload.mentionAccessIds.map(normalizeId).filter(Boolean)
      : [],
    notifiedOverdue: Boolean(payload.notifiedOverdue),
    color: payload.color ?? null,
    createdAt: toIsoDate(payload.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDate(payload.updatedAt) || new Date().toISOString(),
  };
}

function mapLeadRow(payload = {}) {
  const id = normalizeId(payload.id || payload._id);
  if (!id) return null;
  return {
    id,
    tenantId: normalizeId(payload.tenantId),
    personId: normalizeId(payload.personId),
    name: String(payload.name || ''),
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    crmType: payload.crmType || 'sales',
    leadStatus: payload.leadStatus || 'New',
    callStatus: payload.callStatus || 'Pending',
    status: payload.status || 'active',
    assignedRepId: normalizeId(payload.assignedRepId),
    createdById: normalizeId(payload.createdById || payload.createdBy),
    updatedAt: toIsoDate(payload.updatedAt) || new Date().toISOString(),
    createdAt: toIsoDate(payload.createdAt) || new Date().toISOString(),
  };
}

function mapAttendanceRow(payload = {}) {
  const id = normalizeId(payload.id || payload._id);
  const userId = normalizeId(payload.userId);
  if (!id || !userId) return null;
  return {
    id,
    userId,
    username: payload.username ?? null,
    date: toIsoDate(payload.date) || new Date().toISOString(),
    inTimeRecord: toJson(payload.inTimeRecord),
    outTimeRecord: toJson(payload.outTimeRecord),
    isHalfDay: Boolean(payload.isHalfDay),
    onLeave: Boolean(payload.onLeave),
    reason: payload.reason ?? null,
    createdById: normalizeId(payload.createdById || payload.createdBy),
    overtimeMinutes: Number(payload.overtimeMinutes) || 0,
    systemHours: Number(payload.systemHours) || 0,
    loggedHours: Number(payload.loggedHours) || 0,
    unloggedMinutes: Number(payload.unloggedMinutes) || 0,
    discrepancyMinutes: Number(payload.discrepancyMinutes) || 0,
    xpGrantedAt: toIsoDate(payload.xpGrantedAt),
    createdAt: toIsoDate(payload.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDate(payload.updatedAt) || new Date().toISOString(),
  };
}

function mapTaskActivityRow(payload = {}) {
  const id = normalizeId(payload.id || payload._id);
  const taskId = normalizeId(payload.taskId);
  const actorId = normalizeId(payload.actorId);
  if (!id || !taskId || !actorId) return null;
  return {
    _id: id,
    tenantId: normalizeId(payload.tenantId),
    taskId,
    type: String(payload.type || ''),
    body: String(payload.body || ''),
    actorId,
    assigneeId: normalizeId(payload.assigneeId),
    assignedById: normalizeId(payload.assignedById),
    mentionedUserIds: Array.isArray(payload.mentionedUserIds)
      ? payload.mentionedUserIds.map(normalizeId).filter(Boolean)
      : [],
    statusFrom: payload.statusFrom ?? null,
    statusTo: payload.statusTo ?? null,
    fieldKey: payload.fieldKey ?? null,
    valueFrom: payload.valueFrom ?? null,
    valueTo: payload.valueTo ?? null,
    createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : new Date(),
  };
}

const ENTITY_MAPPERS = {
  Task: mapTaskRow,
  Lead: mapLeadRow,
  Attendance: mapAttendanceRow,
};

function mapPayloadForEntity(entityName, payload) {
  const mapper = ENTITY_MAPPERS[entityName];
  if (!mapper) return null;
  return mapper(payload);
}

module.exports = {
  normalizeId,
  mapTaskRow,
  mapLeadRow,
  mapAttendanceRow,
  mapTaskActivityRow,
  mapPayloadForEntity,
};
