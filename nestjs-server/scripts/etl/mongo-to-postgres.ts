/**
 * Phase 3 — MongoDB → PostgreSQL ETL
 *
 * Reads from Mongoose (Express server models) and writes to Prisma/Postgres.
 * Preserves Mongo _id as Prisma String id.
 *
 * Usage:
 *   npm run etl:mongo-to-postgres -- --dry-run
 *   npm run etl:mongo-to-postgres -- --tier=1
 *   npm run etl:mongo-to-postgres -- --collection=leads
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import type mongoose from 'mongoose';
import { Prisma, PrismaClient } from '@prisma/client';

const SERVER_ROOT = path.resolve(__dirname, '../../../server');
const serverRequire = createRequire(path.join(SERVER_ROOT, 'package.json'));
const mongoose = serverRequire('mongoose') as typeof import('mongoose');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BATCH_SIZE = 500;

type Tier = 1 | 2 | 3 | 4;

type PrismaDelegate =
  | 'tenant'
  | 'user'
  | 'department'
  | 'workspace'
  | 'project'
  | 'projectMember'
  | 'phase'
  | 'person'
  | 'team'
  | 'task'
  | 'taskAssignment'
  | 'taskType'
  | 'taskDependency'
  | 'taskMentionAccess'
  | 'lead'
  | 'leadNote'
  | 'leadExlyOffering'
  | 'cRMConfig'
  | 'cRMImport'
  | 'exlyBooking'
  | 'attendance'
  | 'leaveRequest'
  | 'gamificationConfig'
  | 'notification'
  | 'personIdentifier'
  | 'projectGoal'
  | 'taskActivity'
  | 'mailEvent';

interface CollectionDef {
  tier: Tier;
  key: string;
  label: string;
  mongoModelPath: string;
  prismaDelegate: PrismaDelegate;
  map: (doc: MongoDoc) => Record<string, unknown>;
  filterBatch?: (
    prisma: PrismaClient,
    batch: Record<string, unknown>[],
  ) => Promise<Record<string, unknown>[]>;
}

interface MongoDoc {
  _id: mongoose.Types.ObjectId;
  [key: string]: unknown;
}

interface CliOptions {
  dryRun: boolean;
  tier?: Tier;
  collection?: string;
}

interface RunStats {
  key: string;
  label: string;
  tier: Tier;
  mongoCount: number;
  postgresCountBefore: number;
  postgresCountAfter: number;
  scanned: number;
  inserted: number;
  skippedDryRun: number;
}

interface CliArgs {
  dryRun: boolean;
  tier?: Tier;
  collection?: string;
  exclude: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const dryRun = argv.includes('--dry-run');
  const tierRaw = argv.find((a) => a.startsWith('--tier='))?.split('=')[1];
  const collection = argv.find((a) => a.startsWith('--collection='))?.split('=')[1]?.toLowerCase();
  const excludeRaw = argv.find((a) => a.startsWith('--exclude='))?.split('=')[1];
  const exclude = excludeRaw
    ? excludeRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  let tier: Tier | undefined;
  if (tierRaw) {
    const n = Number(tierRaw);
    if (![1, 2, 3, 4].includes(n)) {
      throw new Error(`Invalid --tier=${tierRaw}. Use 1, 2, 3, or 4.`);
    }
    tier = n as Tier;
  }

  return { dryRun, tier, collection, exclude };
}

function toId(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function toIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map(toId).filter((v): v is string => Boolean(v));
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function toFloat(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  return String(value).toLowerCase() === 'true';
}

function toStr(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  return String(value);
}

function toOptStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function requireMongoModel(relativePath: string): mongoose.Model<unknown> {
  return serverRequire(path.join(SERVER_ROOT, relativePath)) as mongoose.Model<unknown>;
}

const COLLECTIONS: CollectionDef[] = [
  {
    tier: 1,
    key: 'tenants',
    label: 'Tenant',
    mongoModelPath: 'models/Tenant.js',
    prismaDelegate: 'tenant',
    map: (doc) => ({
      id: toId(doc._id)!,
      name: toStr(doc.name),
      domain: toOptStr(doc.domain),
      status: toStr(doc.status, 'trial'),
      contactEmail: toStr(doc.contactEmail),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 1,
    key: 'departments',
    label: 'Department',
    mongoModelPath: 'models/Department.js',
    prismaDelegate: 'department',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name),
      slug: toStr(doc.slug).toLowerCase(),
      color: toStr(doc.color, '#3b82f6'),
      sortOrder: toInt(doc.sortOrder),
      signupAllowed: toBool(doc.signupAllowed, true),
      permissionPreset: toStr(doc.permissionPreset, 'standard'),
      pagePermissions: Array.isArray(doc.pagePermissions)
        ? doc.pagePermissions.map((p) => toStr(p))
        : [],
      createdAt: toDate(doc.createdAt) ?? new Date(),
    }),
  },
  {
    tier: 1,
    key: 'users',
    label: 'User',
    mongoModelPath: 'models/User.js',
    prismaDelegate: 'user',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name),
      email: toStr(doc.email).toLowerCase(),
      password: toOptStr(doc.password),
      avatar: toOptStr(doc.avatar),
      gender: toOptStr(doc.gender),
      dateOfBirth: toDate(doc.dateOfBirth),
      phone: toStr(doc.phone, ''),
      lastOnline: toDate(doc.lastOnline),
      online: toBool(doc.online),
      teams: Array.isArray(doc.teams) ? doc.teams.map((t) => toStr(t)) : [],
      departmentId: toId(doc.departmentId),
      exp: toInt(doc.exp),
      level: toInt(doc.level, 1),
      dailyStreak: toInt(doc.dailyStreak),
      googleId: toOptStr(doc.googleId),
      googleAccessToken: toOptStr(doc.googleAccessToken),
      googleRefreshToken: toOptStr(doc.googleRefreshToken),
      googleCalendarLinked: toBool(doc.googleCalendarLinked),
      googleAccounts: toJson(doc.googleAccounts),
      repId: toOptStr(doc.repId),
      mustChangePassword: toBool(doc.mustChangePassword),
      passwordChangedAt: toDate(doc.passwordChangedAt),
      pushSubscriptions: toJson(doc.pushSubscriptions),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 2,
    key: 'workspaces',
    label: 'Workspace',
    mongoModelPath: 'models/Workspace.js',
    prismaDelegate: 'workspace',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name).toUpperCase(),
      color: toStr(doc.color, '#64748b'),
      order: toInt(doc.order),
      defaultMembers: toJson(doc.defaultMembers),
      createdById: toId(doc.createdBy),
      createdAt: toDate(doc.createdAt) ?? new Date(),
    }),
  },
  {
    tier: 2,
    key: 'projects',
    label: 'Project',
    mongoModelPath: 'domains/projects/models/Project.js',
    prismaDelegate: 'project',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name),
      description: toOptStr(doc.description),
      outletId: toStr(doc.outletId),
      ownerId: toId(doc.owner)!,
      status: toStr(doc.status, 'active'),
      tags: Array.isArray(doc.tags) ? doc.tags.map((t) => toStr(t)) : [],
      teams: Array.isArray(doc.teams) ? doc.teams.map((t) => toStr(t)) : [],
      progress: toInt(doc.progress),
      totalTasksCount: toInt(doc.totalTasksCount),
      completedTasksCount: toInt(doc.completedTasksCount),
      linkedCalendars: toJson(doc.linkedCalendars),
      color: toStr(doc.color, '#3b82f6'),
      workspace: toStr(doc.workspace, 'General'),
      starred: toBool(doc.starred),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 2,
    key: 'phases',
    label: 'Phase',
    mongoModelPath: 'domains/projects/models/Phase.js',
    prismaDelegate: 'phase',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name),
      description: toOptStr(doc.description),
      projectId: toId(doc.projectId)!,
      dueDate: toDate(doc.dueDate),
      status: toStr(doc.status, 'todo'),
      isExternal: toBool(doc.isExternal),
      progress: toInt(doc.progress),
      createdAt: toDate(doc.createdAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const projectIds = new Set(
        (await prisma.project.findMany({ select: { id: true } })).map((row) => row.id),
      );
      return batch.filter((row) => projectIds.has(String(row.projectId || '')));
    },
  },
  {
    tier: 2,
    key: 'persons',
    label: 'Person',
    mongoModelPath: 'models/Person.js',
    prismaDelegate: 'person',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      canonicalName: toStr(doc.canonicalName),
      nameKey: toOptStr(doc.nameKey),
      city: toOptStr(doc.city),
      country: toOptStr(doc.country),
      firstSeenAt: toDate(doc.firstSeenAt) ?? new Date(),
      lastSeenAt: toDate(doc.lastSeenAt) ?? new Date(),
      identityVersion: toInt(doc.identityVersion, 1),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 2,
    key: 'teams',
    label: 'Team',
    mongoModelPath: 'models/Team.js',
    prismaDelegate: 'team',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name).toUpperCase(),
      description: toOptStr(doc.description),
      color: toStr(doc.color, '#3b82f6'),
      createdById: toId(doc.createdBy),
      createdAt: toDate(doc.createdAt) ?? new Date(),
    }),
  },
  {
    tier: 3,
    key: 'tasks',
    label: 'Task',
    mongoModelPath: 'models/Task.js',
    prismaDelegate: 'task',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      title: toStr(doc.title),
      description: toOptStr(doc.description),
      status: toStr(doc.status, 'todo').toLowerCase(),
      priority: toStr(doc.priority, 'medium'),
      type: toStr(doc.type, ''),
      scheduleSlot: toStr(doc.scheduleSlot, 'FULL'),
      scheduleDate: toDate(doc.scheduleDate),
      notifiedWarning: toBool(doc.notifiedWarning),
      projectId: toId(doc.projectId),
      workspace: toStr(doc.workspace, 'General'),
      phaseId: toId(doc.phaseId),
      parentTaskId: toId(doc.parentTaskId),
      startDate: toDate(doc.startDate),
      dueDate: toDate(doc.dueDate),
      duration: doc.duration == null ? null : toInt(doc.duration),
      plannedHours: toFloat(doc.plannedHours),
      actualHours: toFloat(doc.actualHours),
      progress: toInt(doc.progress),
      completedAt: toDate(doc.completedAt),
      createdById: toId(doc.createdBy),
      notifiedOverdue: toBool(doc.notifiedOverdue),
      color: toOptStr(doc.color),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const projectIds = new Set(
        (await prisma.project.findMany({ select: { id: true } })).map((row) => row.id),
      );
      const phaseIds = new Set(
        (await prisma.phase.findMany({ select: { id: true } })).map((row) => row.id),
      );
      return batch
        .filter((row) => !row.projectId || projectIds.has(String(row.projectId)))
        .map((row) => {
          const next = { ...row };
          if (next.phaseId && !phaseIds.has(String(next.phaseId))) next.phaseId = null;
          return next;
        });
    },
  },
  {
    tier: 3,
    key: 'taskassignments',
    label: 'TaskAssignment',
    mongoModelPath: 'domains/tasks/models/TaskAssignment.js',
    prismaDelegate: 'taskAssignment',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      taskId: toId(doc.taskId)!,
      userId: toId(doc.userId)!,
      assignedAt: toDate(doc.assignedAt) ?? new Date(),
      assignedById: toId(doc.assignedBy),
    }),
    filterBatch: async (prisma, batch) => {
      const tasks = await prisma.task.findMany({ select: { id: true, tenantId: true } });
      const taskById = new Map(tasks.map((row) => [row.id, row.tenantId]));
      const userIds = new Set(
        (await prisma.user.findMany({ select: { id: true } })).map((row) => row.id),
      );
      return batch
        .filter(
          (row) =>
            taskById.has(String(row.taskId || '')) && userIds.has(String(row.userId || '')),
        )
        .map((row) => ({
          ...row,
          tenantId: row.tenantId || taskById.get(String(row.taskId || '')),
        }))
        .filter((row) => Boolean(row.tenantId));
    },
  },
  {
    tier: 3,
    key: 'leads',
    label: 'Lead',
    mongoModelPath: 'models/Lead.js',
    prismaDelegate: 'lead',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      personId: toId(doc.personId),
      rowId: toOptStr(doc.rowId),
      customerIdExly: toOptStr(doc.customerIdExly),
      transactionIdExly: toOptStr(doc.transactionIdExly),
      exlyOfferingId: toOptStr(doc.exlyOfferingId),
      exlyOfferingTitle: toOptStr(doc.exlyOfferingTitle),
      crmType: toStr(doc.crmType, 'sales'),
      artistProject: toOptStr(doc.artistProject),
      contactCategory: toOptStr(doc.contactCategory),
      name: toStr(doc.name),
      nameKey: toOptStr(doc.nameKey),
      email: toOptStr(doc.email),
      phone: toOptStr(doc.phone),
      city: toOptStr(doc.city),
      webinarDates: toOptStr(doc.webinarDates),
      attended: toOptStr(doc.attended),
      attendanceDurationMin: toOptStr(doc.attendanceDurationMin),
      qnaAnswered: toOptStr(doc.qnaAnswered),
      artistType: toOptStr(doc.artistType),
      fullTimeWillingness: toOptStr(doc.fullTimeWillingness),
      primaryRole: toOptStr(doc.primaryRole),
      learningGoal: toOptStr(doc.learningGoal),
      learnedMusic: toOptStr(doc.learnedMusic),
      currentJourney: toOptStr(doc.currentJourney),
      meaningfulConnect: toStr(doc.meaningfulConnect, 'PENDING'),
      leadQuality: toStr(doc.leadQuality, '1'),
      callStatus: toStr(doc.callStatus, 'Pending'),
      leadStatus: toStr(doc.leadStatus, 'New'),
      remarks: toOptStr(doc.remarks),
      source: toStr(doc.source, 'Organic / Direct'),
      planOption: toOptStr(doc.planOption),
      nextFollowupDate: toOptStr(doc.nextFollowupDate),
      nextFollowupTime: toOptStr(doc.nextFollowupTime),
      setReminder: toBool(doc.setReminder),
      assignedRepId: toId(doc.assignedRepId),
      createdById: toId(doc.createdBy),
      importId: toId(doc.importId),
      metadata: toJson(doc.metadata),
      tags: Array.isArray(doc.tags) ? doc.tags.map((t) => toStr(t)) : [],
      emailStatus: toStr(doc.emailStatus, 'Pending'),
      status: toStr(doc.status, 'active'),
      location: toOptStr(doc.location),
      bounceCount: toInt(doc.bounceCount),
      unsubscribed: toBool(doc.unsubscribed),
      unsubscribeReason: toOptStr(doc.unsubscribeReason),
      lockedBy: toOptStr(doc.lockedBy),
      lockedAt: toDate(doc.lockedAt),
      reminderSent: toBool(doc.reminderSent),
      notifiedOverdue: toBool(doc.notifiedOverdue),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 3,
    key: 'exlybookings',
    label: 'ExlyBooking',
    mongoModelPath: 'models/ExlyBooking.js',
    prismaDelegate: 'exlyBooking',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      personId: toId(doc.personId),
      name: toStr(doc.name),
      nameKey: toOptStr(doc.nameKey),
      email: toOptStr(doc.email),
      phone: toStr(doc.phone),
      offeringTitle: toStr(doc.offeringTitle),
      offeringId: toStr(doc.offeringId),
      pricePaid: toFloat(doc.pricePaid),
      bookedOn: toDate(doc.bookedOn) ?? new Date(),
      paymentType: toOptStr(doc.paymentType),
      debitType: toOptStr(doc.debitType),
      offeringType: toOptStr(doc.offeringType),
      offeringOwner: toOptStr(doc.offeringOwner),
      promotionType: toOptStr(doc.promotionType),
      promotionFromOffering: toOptStr(doc.promotionFromOffering),
      transactionId: toOptStr(doc.transactionId),
      customerId: toOptStr(doc.customerId),
      state: toOptStr(doc.state),
      payoutStatus: toOptStr(doc.payoutStatus),
      emailStatus: toStr(doc.emailStatus, 'Pending'),
      bounceCount: toInt(doc.bounceCount),
      unsubscribed: toBool(doc.unsubscribed),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 3,
    key: 'attendance',
    label: 'Attendance',
    mongoModelPath: 'models/Attendance.js',
    prismaDelegate: 'attendance',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      userId: toId(doc.userId)!,
      username: toOptStr(doc.username),
      date: toDate(doc.date) ?? new Date(),
      inTimeRecord: toJson(doc.inTimeRecord),
      outTimeRecord: toJson(doc.outTimeRecord),
      isHalfDay: toBool(doc.isHalfDay),
      onLeave: toBool(doc.onLeave),
      reason: toOptStr(doc.reason),
      createdById: toId(doc.createdBy),
      overtimeMinutes: toInt(doc.overtimeMinutes),
      systemHours: toFloat(doc.systemHours),
      loggedHours: toFloat(doc.loggedHours),
      unloggedMinutes: toInt(doc.unloggedMinutes),
      discrepancyMinutes: toInt(doc.discrepancyMinutes),
      xpGrantedAt: toDate(doc.xpGrantedAt),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const users = await prisma.user.findMany({ select: { id: true, tenantId: true } });
      const tenantByUser = new Map(users.map((row) => [row.id, row.tenantId]));
      return batch
        .filter((row) => tenantByUser.has(String(row.userId || '')))
        .map((row) => ({
          ...row,
          tenantId: row.tenantId || tenantByUser.get(String(row.userId || '')),
        }))
        .filter((row) => Boolean(row.tenantId));
    },
  },
  {
    tier: 3,
    key: 'tasktypes',
    label: 'TaskType',
    mongoModelPath: 'domains/tasks/models/TaskType.js',
    prismaDelegate: 'taskType',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name),
      departmentId: toId(doc.departmentId),
      projectRole: toOptStr(doc.projectRole),
      isActive: toBool(doc.isActive, true),
      createdAt: toDate(doc.createdAt) ?? new Date(),
    }),
  },
  {
    tier: 3,
    key: 'leaverequests',
    label: 'LeaveRequest',
    mongoModelPath: 'models/LeaveRequest.js',
    prismaDelegate: 'leaveRequest',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      userId: toId(doc.userId)!,
      username: toOptStr(doc.username),
      fromDate: toDate(doc.fromDate) ?? new Date(),
      toDate: toDate(doc.toDate) ?? new Date(),
      reason: toStr(doc.reason, ''),
      status: toStr(doc.status, 'pending'),
      reviewedById: toId(doc.reviewedBy),
      reviewedAt: toDate(doc.reviewedAt),
      reviewNote: toStr(doc.reviewNote, ''),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const users = await prisma.user.findMany({ select: { id: true, tenantId: true } });
      const tenantByUser = new Map(users.map((row) => [row.id, row.tenantId]));
      return batch
        .filter((row) => tenantByUser.has(String(row.userId || '')))
        .map((row) => ({
          ...row,
          tenantId: row.tenantId || tenantByUser.get(String(row.userId || '')),
        }))
        .filter((row) => Boolean(row.tenantId));
    },
  },
  {
    tier: 3,
    key: 'crmconfigs',
    label: 'CRMConfig',
    mongoModelPath: 'domains/crm/models/CRMConfig.js',
    prismaDelegate: 'cRMConfig',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      configKey: toStr(doc.configKey, 'default'),
      callStatuses: toJson(doc.callStatuses ?? []),
      leadStatuses: toJson(doc.leadStatuses ?? []),
      artistTypes: toJson(doc.artistTypes ?? []),
      meaningfulConnectStatuses: toJson(doc.meaningfulConnectStatuses ?? []),
      qualities: toJson(doc.qualities ?? []),
      updatedById: toId(doc.updatedBy),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 3,
    key: 'crmimports',
    label: 'CRMImport',
    mongoModelPath: 'domains/crm/models/CRMImport.js',
    prismaDelegate: 'cRMImport',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      filename: toStr(doc.filename),
      leadCount: toInt(doc.leadCount),
      crmType: toStr(doc.crmType, 'sales'),
      sheetTemplate: toOptStr(doc.sheetTemplate),
      createdById: toId(doc.createdBy)!,
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const userIds = new Set(
        (await prisma.user.findMany({ select: { id: true } })).map((row) => row.id),
      );
      return batch.filter((row) => userIds.has(String(row.createdById || '')));
    },
  },
  {
    tier: 3,
    key: 'gamificationconfigs',
    label: 'GamificationConfig',
    mongoModelPath: 'models/GamificationConfig.js',
    prismaDelegate: 'gamificationConfig',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      taskCompletion: toInt(doc.taskCompletion, 10),
      taskCreation: toInt(doc.taskCreation, 5),
      projectCreation: toInt(doc.projectCreation, 15),
      dailyLog: toInt(doc.dailyLog, 5),
      attendanceLog: toInt(doc.attendanceLog, 5),
      attendanceDayBonus: toInt(doc.attendanceDayBonus, 20),
      assetUpload: toInt(doc.assetUpload, 5),
      leadCapture: toInt(doc.leadCapture, 10),
      invoiceSubmission: toInt(doc.invoiceSubmission, 10),
      reviewApproval: toInt(doc.reviewApproval, 5),
      calendarEventCreated: toInt(doc.calendarEventCreated, 5),
      announcementCreated: toInt(doc.announcementCreated, 5),
      leaveApplied: toInt(doc.leaveApplied, 0),
      commentCreation: toInt(doc.commentCreation, 0),
      dailyMissionBaseReward: toInt(doc.dailyMissionBaseReward, 25),
      stepXp: toInt(doc.stepXp, 5),
      baseXp: toInt(doc.baseXp, 0),
      lastRecalculatedAt: toDate(doc.lastRecalculatedAt),
      lastRecalcWeeklyPrior: toJson(doc.lastRecalcWeeklyPrior),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const tenants = await prisma.tenant.findMany({ select: { id: true } });
      if (tenants.length === 0) return [];
      const byTenant = new Map<string, Record<string, unknown>>();
      for (const row of batch) {
        const tenantId = String(row.tenantId || tenants[0].id);
        if (!byTenant.has(tenantId)) {
          byTenant.set(tenantId, { ...row, tenantId });
        }
      }
      return [...byTenant.values()];
    },
  },
  {
    tier: 3,
    key: 'notifications',
    label: 'Notification',
    mongoModelPath: 'models/Notification.js',
    prismaDelegate: 'notification',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      recipientId: toId(doc.recipient)!,
      title: toStr(doc.title),
      message: toStr(doc.message),
      type: toStr(doc.type, 'reminder'),
      category: toStr(doc.category, 'system'),
      read: toBool(doc.read),
      relatedLeadId: toId(doc.relatedLeadId),
      relatedTaskId: toId(doc.relatedTaskId),
      relatedProjectId: toId(doc.relatedProjectId),
      actionUrl: toStr(doc.actionUrl, ''),
      actorId: toId(doc.actorId),
      iconType: toStr(doc.iconType, 'system'),
      emailSent: toBool(doc.emailSent),
      createdAt: toDate(doc.createdAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const userIds = new Set(
        (await prisma.user.findMany({ select: { id: true, tenantId: true } })).map((row) => row.id),
      );
      const users = await prisma.user.findMany({ select: { id: true, tenantId: true } });
      const tenantByUser = new Map(users.map((row) => [row.id, row.tenantId]));
      return batch
        .filter((row) => userIds.has(String(row.recipientId || '')))
        .map((row) => ({
          ...row,
          tenantId: row.tenantId || tenantByUser.get(String(row.recipientId || '')),
        }))
        .filter((row) => Boolean(row.tenantId));
    },
  },
  {
    tier: 3,
    key: 'personidentifiers',
    label: 'PersonIdentifier',
    mongoModelPath: 'models/PersonIdentifier.js',
    prismaDelegate: 'personIdentifier',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      personId: toId(doc.personId)!,
      type: toStr(doc.type),
      valueNormalized: toStr(doc.valueNormalized),
      source: toStr(doc.source, 'unknown'),
      verified: toBool(doc.verified),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const persons = await prisma.person.findMany({ select: { id: true, tenantId: true } });
      const personIds = new Set(persons.map((row) => row.id));
      const tenantByPerson = new Map(persons.map((row) => [row.id, row.tenantId]));
      return batch
        .filter((row) => personIds.has(String(row.personId || '')))
        .map((row) => ({
          ...row,
          tenantId: row.tenantId || tenantByPerson.get(String(row.personId || '')),
        }))
        .filter((row) => Boolean(row.tenantId));
    },
  },
  {
    tier: 2,
    key: 'projectgoals',
    label: 'ProjectGoal',
    mongoModelPath: 'domains/projects/models/ProjectGoal.js',
    prismaDelegate: 'projectGoal',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      projectId: toId(doc.projectId)!,
      startDate: toDate(doc.startDate),
      endDate: toDate(doc.endDate),
      targets: toJson(doc.targets ?? {}),
      sourceLinks: toJson(doc.sourceLinks ?? {}),
      metricOverrides: toJson(doc.metricOverrides ?? {}),
      updatedById: toId(doc.updatedBy),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
    filterBatch: async (prisma, batch) => {
      const projectIds = new Set(
        (await prisma.project.findMany({ select: { id: true } })).map((row) => row.id),
      );
      return batch.filter((row) => projectIds.has(String(row.projectId || '')));
    },
  },
  {
    tier: 4,
    key: 'taskactivities',
    label: 'TaskActivity',
    mongoModelPath: 'models/TaskActivity.js',
    prismaDelegate: 'taskActivity',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      taskId: toId(doc.taskId)!,
      type: toStr(doc.type),
      body: toStr(doc.body, ''),
      actorId: toId(doc.actorId)!,
      assigneeId: toId(doc.assigneeId),
      assignedById: toId(doc.assignedById),
      mentionedUserIds: toIds(doc.mentionedUserIds),
      statusFrom: toOptStr(doc.statusFrom),
      statusTo: toOptStr(doc.statusTo),
      fieldKey: toOptStr(doc.fieldKey),
      valueFrom: toOptStr(doc.valueFrom),
      valueTo: toOptStr(doc.valueTo),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 4,
    key: 'mailevents',
    label: 'MailEvent',
    mongoModelPath: 'models/MailEvent.js',
    prismaDelegate: 'mailEvent',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      messageId: toOptStr(doc.messageId),
      eventType: toStr(doc.eventType),
      email: toOptStr(doc.email),
      timestamp: toDate(doc.timestamp) ?? new Date(),
      metadata: toJson(doc.metadata),
      campaignId: toId(doc.campaignId),
      senderProfileId: toId(doc.senderProfileId),
      rotationProvider: toOptStr(doc.rotationProvider),
      linkClicked: toOptStr(doc.linkClicked),
      ipAddress: toOptStr(doc.ipAddress),
      userAgent: toOptStr(doc.userAgent),
      location: toJson(doc.location),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  // LeadNote / LeadExlyOffering / TaskDependency / TaskMentionAccess — flattened in migrate* helpers.
];

function resolveMongoUri(): string {
  const uri = (
    process.env.MONGODB_URI
    || process.env.MONGO_URI
    || ''
  ).trim();

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy server/.env.example → server/.env and set MONGODB_URI.',
    );
  }

  return uri;
}

function resolvePostgresUrl(): string {
  const url = (
    process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || ''
  ).trim();

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Point it at staging Postgres (never production Mongo).',
    );
  }

  if (url.startsWith('mongodb')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string, not MongoDB.');
  }

  return url;
}

function selectCollections(options: CliOptions): CollectionDef[] {
  const aliases: Record<string, string> = {
    tenant: 'tenants',
    user: 'users',
    department: 'departments',
    platformsettings: 'platformsettings',
    project: 'projects',
    person: 'persons',
    team: 'teams',
    task: 'tasks',
    lead: 'leads',
    exlybooking: 'exlybookings',
    attendance: 'attendance',
    taskactivity: 'taskactivities',
    mailevent: 'mailevents',
    notification: 'notifications',
  };

  let selected = [...COLLECTIONS];

  if (options.tier) {
    selected = selected.filter((c) => c.tier === options.tier);
  }

  if (options.collection) {
    const normalized = aliases[options.collection] || options.collection;
    selected = selected.filter((c) => c.key === normalized);
    if (selected.length === 0) {
      const available = COLLECTIONS.map((c) => c.key).join(', ');
      throw new Error(`Unknown --collection=${options.collection}. Available: ${available}`);
    }
  }

  if (options.exclude.length > 0) {
    const skip = new Set(options.exclude);
    selected = selected.filter((c) => !skip.has(c.key));
  }

  return selected.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return COLLECTIONS.findIndex((c) => c.key === a.key) - COLLECTIONS.findIndex((c) => c.key === b.key);
  });
}

async function countPostgres(prisma: PrismaClient, delegate: PrismaDelegate): Promise<number> {
  const model = prisma[delegate] as { count: () => Promise<number> };
  return model.count();
}

async function countMongo(Model: mongoose.Model<unknown>): Promise<number> {
  return Model.countDocuments({}).setOptions({ bypassTenant: true });
}

async function insertBatch(
  prisma: PrismaClient,
  def: CollectionDef,
  delegate: {
    createMany: (args: {
      data: Record<string, unknown>[];
      skipDuplicates: boolean;
    }) => Promise<{ count: number }>;
  },
  batch: Record<string, unknown>[],
): Promise<number> {
  let data = batch;
  if (def.filterBatch) {
    data = await def.filterBatch(prisma, batch);
  }
  if (data.length === 0) return 0;
  const result = await delegate.createMany({ data, skipDuplicates: true });
  return result.count;
}

async function migrateCollection(
  prisma: PrismaClient,
  def: CollectionDef,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel(def.mongoModelPath);
  const delegate = prisma[def.prismaDelegate] as {
    count: () => Promise<number>;
    createMany: (args: { data: Record<string, unknown>[]; skipDuplicates: boolean }) => Promise<{ count: number }>;
  };

  const mongoCount = await countMongo(Model);
  const postgresCountBefore = await countPostgres(prisma, def.prismaDelegate);

  console.log(`\n[Tier ${def.tier}] ${def.label} (${def.key})`);
  console.log(`  Mongo: ${mongoCount} | Postgres (before): ${postgresCountBefore}`);

  if (mongoCount === 0) {
    return {
      key: def.key,
      label: def.label,
      tier: def.tier,
      mongoCount,
      postgresCountBefore,
      postgresCountAfter: postgresCountBefore,
      scanned: 0,
      inserted: 0,
      skippedDryRun: 0,
    };
  }

  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Record<string, unknown>[] = [];
  let scanned = 0;
  let inserted = 0;

  for await (const raw of cursor) {
    const doc = raw as MongoDoc;
    scanned += 1;
    batch.push(def.map(doc));

    if (batch.length >= BATCH_SIZE) {
      if (dryRun) {
        batch = [];
        continue;
      }
      inserted += await insertBatch(prisma, def, delegate, batch);
      batch = [];
      process.stdout.write(`  … ${scanned}/${mongoCount} scanned, ${inserted} inserted\r`);
    }
  }

  if (batch.length > 0 && !dryRun) {
    inserted += await insertBatch(prisma, def, delegate, batch);
  }

  const postgresCountAfter = dryRun
    ? postgresCountBefore
    : await countPostgres(prisma, def.prismaDelegate);

  const skippedDryRun = dryRun ? scanned : 0;

  console.log(
    dryRun
      ? `  DRY RUN — would migrate ${scanned} docs (no writes)`
      : `  Done — scanned ${scanned}, inserted ${inserted}, Postgres (after): ${postgresCountAfter}`,
  );

  return {
    key: def.key,
    label: def.label,
    tier: def.tier,
    mongoCount,
    postgresCountBefore,
    postgresCountAfter,
    scanned,
    inserted,
    skippedDryRun,
  };
}

async function migrateCollectionMongoOnly(
  def: CollectionDef,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel(def.mongoModelPath);
  const mongoCount = await countMongo(Model);

  console.log(`\n[Tier ${def.tier}] ${def.label} (${def.key})`);
  console.log(`  Mongo: ${mongoCount} | Postgres: (not connected)`);

  if (mongoCount === 0 || !dryRun) {
    return {
      key: def.key,
      label: def.label,
      tier: def.tier,
      mongoCount,
      postgresCountBefore: -1,
      postgresCountAfter: -1,
      scanned: dryRun ? mongoCount : 0,
      inserted: 0,
      skippedDryRun: dryRun ? mongoCount : 0,
    };
  }

  let scanned = 0;
  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  for await (const _raw of cursor) {
    scanned += 1;
  }

  console.log(`  DRY RUN — would migrate ${scanned} docs (no writes)`);

  return {
    key: def.key,
    label: def.label,
    tier: def.tier,
    mongoCount,
    postgresCountBefore: -1,
    postgresCountAfter: -1,
    scanned,
    inserted: 0,
    skippedDryRun: scanned,
  };
}

async function migrateProjectMembers(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel('domains/projects/models/Project.js');
  const mongoCount = await countMongo(Model);
  const postgresCountBefore = await countPostgres(prisma, 'projectMember');

  console.log(`\n[Tier 2] ProjectMember (flattened from projects)`);
  console.log(`  Mongo projects: ${mongoCount} | Postgres (before): ${postgresCountBefore}`);

  if (mongoCount === 0 || dryRun) {
    return {
      key: 'projectmembers',
      label: 'ProjectMember',
      tier: 2,
      mongoCount,
      postgresCountBefore,
      postgresCountAfter: postgresCountBefore,
      scanned: 0,
      inserted: 0,
      skippedDryRun: dryRun ? mongoCount : 0,
    };
  }

  const validUserIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((row) => row.id),
  );

  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Record<string, unknown>[] = [];
  let scanned = 0;
  let inserted = 0;

  for await (const raw of cursor) {
    const doc = raw as MongoDoc & {
      members?: unknown[];
      memberRoles?: Array<{ user?: unknown; role?: string }>;
      owner?: unknown;
    };
    scanned += 1;
    const projectId = toId(doc._id)!;
    const tenantId = toId(doc.tenantId);
    const roleByUser = new Map<string, string>();

    if (Array.isArray(doc.memberRoles)) {
      for (const row of doc.memberRoles) {
        const userId = toId(row.user);
        if (userId) roleByUser.set(userId, toStr(row.role, 'member'));
      }
    }

    const memberIds = new Set(toIds(doc.members));
    for (const userId of memberIds) {
      if (!validUserIds.has(userId)) continue;
      batch.push({
        id: `${projectId}_${userId}`,
        tenantId,
        projectId,
        userId,
        role: roleByUser.get(userId) || 'member',
      });
    }

    const ownerId = toId(doc.owner);
    if (ownerId && !memberIds.has(ownerId) && validUserIds.has(ownerId)) {
      batch.push({
        id: `${projectId}_${ownerId}`,
        tenantId,
        projectId,
        userId: ownerId,
        role: roleByUser.get(ownerId) || 'owner',
      });
    }

    if (batch.length >= BATCH_SIZE) {
      const result = await prisma.projectMember.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += result.count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await prisma.projectMember.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  const postgresCountAfter = await countPostgres(prisma, 'projectMember');
  console.log(
    `  Done — scanned ${scanned} projects, inserted ${inserted} members, Postgres (after): ${postgresCountAfter}`,
  );

  return {
    key: 'projectmembers',
    label: 'ProjectMember',
    tier: 2,
    mongoCount,
    postgresCountBefore,
    postgresCountAfter,
    scanned,
    inserted,
    skippedDryRun: 0,
  };
}

async function migrateTaskDependencies(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel('domains/tasks/models/Task.js');
  const mongoCount = await countMongo(Model);
  const postgresCountBefore = await countPostgres(prisma, 'taskDependency');

  console.log(`\n[Tier 3] TaskDependency (flattened from tasks)`);
  console.log(`  Mongo tasks: ${mongoCount} | Postgres (before): ${postgresCountBefore}`);

  if (mongoCount === 0 || dryRun) {
    return {
      key: 'taskdependencies',
      label: 'TaskDependency',
      tier: 3,
      mongoCount,
      postgresCountBefore,
      postgresCountAfter: postgresCountBefore,
      scanned: 0,
      inserted: 0,
      skippedDryRun: dryRun ? mongoCount : 0,
    };
  }

  const taskIds = new Set(
    (await prisma.task.findMany({ select: { id: true, tenantId: true } })).map((row) => row.id),
  );
  const tenantByTask = new Map(
    (await prisma.task.findMany({ select: { id: true, tenantId: true } })).map((row) => [
      row.id,
      row.tenantId,
    ]),
  );

  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Record<string, unknown>[] = [];
  let scanned = 0;
  let inserted = 0;

  for await (const raw of cursor) {
    const doc = raw as MongoDoc & { dependencies?: unknown[] };
    scanned += 1;
    const taskId = toId(doc._id)!;
    if (!taskIds.has(taskId)) continue;
    const tenantId = toId(doc.tenantId) || tenantByTask.get(taskId);
    for (const dep of toIds(doc.dependencies)) {
      if (!taskIds.has(dep) || dep === taskId) continue;
      batch.push({
        id: `${taskId}:${dep}`,
        tenantId,
        taskId,
        dependsOnTaskId: dep,
      });
    }
    if (batch.length >= BATCH_SIZE) {
      const result = await prisma.taskDependency.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await prisma.taskDependency.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }

  const postgresCountAfter = await countPostgres(prisma, 'taskDependency');
  console.log(
    `  Done — scanned ${scanned} tasks, inserted ${inserted} deps, Postgres (after): ${postgresCountAfter}`,
  );

  return {
    key: 'taskdependencies',
    label: 'TaskDependency',
    tier: 3,
    mongoCount,
    postgresCountBefore,
    postgresCountAfter,
    scanned,
    inserted,
    skippedDryRun: 0,
  };
}

async function migrateTaskMentionAccess(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel('domains/tasks/models/Task.js');
  const mongoCount = await countMongo(Model);
  const postgresCountBefore = await countPostgres(prisma, 'taskMentionAccess');

  console.log(`\n[Tier 3] TaskMentionAccess (flattened from tasks)`);
  console.log(`  Mongo tasks: ${mongoCount} | Postgres (before): ${postgresCountBefore}`);

  if (mongoCount === 0 || dryRun) {
    return {
      key: 'taskmentionaccess',
      label: 'TaskMentionAccess',
      tier: 3,
      mongoCount,
      postgresCountBefore,
      postgresCountAfter: postgresCountBefore,
      scanned: 0,
      inserted: 0,
      skippedDryRun: dryRun ? mongoCount : 0,
    };
  }

  const tasks = await prisma.task.findMany({ select: { id: true, tenantId: true } });
  const taskIds = new Set(tasks.map((row) => row.id));
  const tenantByTask = new Map(tasks.map((row) => [row.id, row.tenantId]));
  const userIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((row) => row.id),
  );

  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Record<string, unknown>[] = [];
  let scanned = 0;
  let inserted = 0;

  for await (const raw of cursor) {
    const doc = raw as MongoDoc & { mentionAccessIds?: unknown[] };
    scanned += 1;
    const taskId = toId(doc._id)!;
    if (!taskIds.has(taskId)) continue;
    const tenantId = toId(doc.tenantId) || tenantByTask.get(taskId);
    for (const userId of toIds(doc.mentionAccessIds)) {
      if (!userIds.has(userId)) continue;
      batch.push({
        id: `${taskId}:${userId}`,
        tenantId,
        taskId,
        userId,
      });
    }
    if (batch.length >= BATCH_SIZE) {
      const result = await prisma.taskMentionAccess.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await prisma.taskMentionAccess.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }

  const postgresCountAfter = await countPostgres(prisma, 'taskMentionAccess');
  console.log(
    `  Done — scanned ${scanned} tasks, inserted ${inserted} mention access rows, Postgres (after): ${postgresCountAfter}`,
  );

  return {
    key: 'taskmentionaccess',
    label: 'TaskMentionAccess',
    tier: 3,
    mongoCount,
    postgresCountBefore,
    postgresCountAfter,
    scanned,
    inserted,
    skippedDryRun: 0,
  };
}

async function migrateLeadNotes(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel('domains/crm/models/Lead.js');
  const mongoCount = await countMongo(Model);
  const postgresCountBefore = await countPostgres(prisma, 'leadNote');

  console.log(`\n[Tier 3] LeadNote (flattened from leads)`);
  console.log(`  Mongo leads: ${mongoCount} | Postgres (before): ${postgresCountBefore}`);

  if (mongoCount === 0 || dryRun) {
    return {
      key: 'leadnotes',
      label: 'LeadNote',
      tier: 3,
      mongoCount,
      postgresCountBefore,
      postgresCountAfter: postgresCountBefore,
      scanned: 0,
      inserted: 0,
      skippedDryRun: dryRun ? mongoCount : 0,
    };
  }

  const leadIds = new Set(
    (await prisma.lead.findMany({ select: { id: true, tenantId: true } })).map((row) => row.id),
  );
  const tenantByLead = new Map(
    (await prisma.lead.findMany({ select: { id: true, tenantId: true } })).map((row) => [
      row.id,
      row.tenantId,
    ]),
  );

  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Record<string, unknown>[] = [];
  let scanned = 0;
  let inserted = 0;

  for await (const raw of cursor) {
    const doc = raw as MongoDoc & {
      notes?: Array<{ text?: string; author?: string; date?: unknown }>;
    };
    scanned += 1;
    const leadId = toId(doc._id)!;
    if (!leadIds.has(leadId)) continue;
    const tenantId = toId(doc.tenantId) || tenantByLead.get(leadId);
    const notes = Array.isArray(doc.notes) ? doc.notes : [];
    notes.forEach((note, index) => {
      const text = toStr(note?.text).trim();
      if (!text) return;
      batch.push({
        id: `${leadId}:note:${index}`,
        tenantId,
        leadId,
        text,
        author: toStr(note?.author, 'unknown'),
        date: toDate(note?.date) ?? new Date(),
      });
    });
    if (batch.length >= BATCH_SIZE) {
      const result = await prisma.leadNote.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await prisma.leadNote.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }

  const postgresCountAfter = await countPostgres(prisma, 'leadNote');
  console.log(
    `  Done — scanned ${scanned} leads, inserted ${inserted} notes, Postgres (after): ${postgresCountAfter}`,
  );

  return {
    key: 'leadnotes',
    label: 'LeadNote',
    tier: 3,
    mongoCount,
    postgresCountBefore,
    postgresCountAfter,
    scanned,
    inserted,
    skippedDryRun: 0,
  };
}

async function migrateLeadExlyOfferings(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<RunStats> {
  const Model = requireMongoModel('domains/crm/models/Lead.js');
  const mongoCount = await countMongo(Model);
  const postgresCountBefore = await countPostgres(prisma, 'leadExlyOffering');

  console.log(`\n[Tier 3] LeadExlyOffering (flattened from leads)`);
  console.log(`  Mongo leads: ${mongoCount} | Postgres (before): ${postgresCountBefore}`);

  if (mongoCount === 0 || dryRun) {
    return {
      key: 'leadexlyofferings',
      label: 'LeadExlyOffering',
      tier: 3,
      mongoCount,
      postgresCountBefore,
      postgresCountAfter: postgresCountBefore,
      scanned: 0,
      inserted: 0,
      skippedDryRun: dryRun ? mongoCount : 0,
    };
  }

  const leads = await prisma.lead.findMany({ select: { id: true, tenantId: true } });
  const leadIds = new Set(leads.map((row) => row.id));
  const tenantByLead = new Map(leads.map((row) => [row.id, row.tenantId]));

  const cursor = Model.find({})
    .setOptions({ bypassTenant: true })
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Record<string, unknown>[] = [];
  let scanned = 0;
  let inserted = 0;

  for await (const raw of cursor) {
    const doc = raw as MongoDoc & {
      exlyOfferings?: Array<{ offeringId?: string; title?: string; purchasedAt?: unknown }>;
    };
    scanned += 1;
    const leadId = toId(doc._id)!;
    if (!leadIds.has(leadId)) continue;
    const tenantId = toId(doc.tenantId) || tenantByLead.get(leadId);
    const offerings = Array.isArray(doc.exlyOfferings) ? doc.exlyOfferings : [];
    offerings.forEach((offering, index) => {
      batch.push({
        id: `${leadId}:offering:${index}`,
        tenantId,
        leadId,
        offeringId: toOptStr(offering?.offeringId),
        title: toOptStr(offering?.title),
        purchasedAt: toDate(offering?.purchasedAt),
      });
    });
    if (batch.length >= BATCH_SIZE) {
      const result = await prisma.leadExlyOffering.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await prisma.leadExlyOffering.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }

  const postgresCountAfter = await countPostgres(prisma, 'leadExlyOffering');
  console.log(
    `  Done — scanned ${scanned} leads, inserted ${inserted} offerings, Postgres (after): ${postgresCountAfter}`,
  );

  return {
    key: 'leadexlyofferings',
    label: 'LeadExlyOffering',
    tier: 3,
    mongoCount,
    postgresCountBefore,
    postgresCountAfter,
    scanned,
    inserted,
    skippedDryRun: 0,
  };
}

function printSummary(stats: RunStats[], dryRun: boolean): void {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(dryRun ? 'ETL SUMMARY (DRY RUN)' : 'ETL SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  console.log(
    `${'Collection'.padEnd(18)} ${'Tier'.padStart(4)} ${'Mongo'.padStart(8)} ${'PG before'.padStart(10)} ${'PG after'.padStart(9)} ${'Inserted'.padStart(9)}`,
  );
  console.log('─'.repeat(68));

  for (const row of stats) {
    const pgBefore = row.postgresCountBefore < 0 ? 'n/a' : String(row.postgresCountBefore);
    const pgAfter = row.postgresCountAfter < 0 ? 'n/a' : String(row.postgresCountAfter);
    console.log(
      `${row.label.padEnd(18)} ${String(row.tier).padStart(4)} ${String(row.mongoCount).padStart(8)} ${pgBefore.padStart(10)} ${pgAfter.padStart(9)} ${String(row.inserted).padStart(9)}`,
    );
  }

  const totalMongo = stats.reduce((sum, r) => sum + r.mongoCount, 0);
  const totalInserted = stats.reduce((sum, r) => sum + r.inserted, 0);
  console.log('─'.repeat(68));
  console.log(
    `${'TOTAL'.padEnd(18)} ${''.padStart(4)} ${String(totalMongo).padStart(8)} ${''.padStart(10)} ${''.padStart(9)} ${String(totalInserted).padStart(9)}`,
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const collections = selectCollections(options);

  console.log('Mongo → PostgreSQL ETL (Phase 3)');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Collections: ${collections.map((c) => c.key).join(', ')}`);

  const mongoUri = resolveMongoUri();
  resolvePostgresUrl();

  await mongoose.connect(mongoUri);
  console.log(`Mongo connected: ${mongoUri.replace(/\/\/.*:.*@/, '//****:****@')}`);

  const prisma = new PrismaClient();
  let postgresReady = false;

  try {
    await prisma.$connect();
    postgresReady = true;
    console.log('Postgres connected via Prisma');
  } catch (err) {
    if (options.dryRun) {
      console.warn(
        `Postgres unavailable (${err instanceof Error ? err.message : err}) — dry-run will report Mongo counts only`,
      );
    } else {
      throw err;
    }
  }

  const stats: RunStats[] = [];

  try {
    for (const def of collections) {
      if (postgresReady) {
        stats.push(await migrateCollection(prisma, def, options.dryRun));
        if (def.key === 'projects' && !options.dryRun) {
          stats.push(await migrateProjectMembers(prisma, options.dryRun));
        }
        if (def.key === 'tasks' && !options.dryRun) {
          stats.push(await migrateTaskDependencies(prisma, options.dryRun));
          stats.push(await migrateTaskMentionAccess(prisma, options.dryRun));
        }
        if (def.key === 'leads' && !options.dryRun) {
          stats.push(await migrateLeadNotes(prisma, options.dryRun));
          stats.push(await migrateLeadExlyOfferings(prisma, options.dryRun));
        }
      } else {
        stats.push(await migrateCollectionMongoOnly(def, options.dryRun));
      }
    }
    printSummary(stats, options.dryRun);
  } finally {
    if (postgresReady) await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\nETL failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
