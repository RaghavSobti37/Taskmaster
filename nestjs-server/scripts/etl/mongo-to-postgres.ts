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
import { PrismaClient, Prisma } from '../../generated/etl-client';

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
  | 'platformSettings'
  | 'project'
  | 'person'
  | 'team'
  | 'task'
  | 'lead'
  | 'exlyBooking'
  | 'attendance'
  | 'taskActivity'
  | 'mailEvent'
  | 'notification';

interface CollectionDef {
  tier: Tier;
  key: string;
  label: string;
  mongoModelPath: string;
  prismaDelegate: PrismaDelegate;
  map: (doc: MongoDoc) => Record<string, unknown>;
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
    tier: 1,
    key: 'platformsettings',
    label: 'PlatformSettings',
    mongoModelPath: 'models/PlatformSettings.js',
    prismaDelegate: 'platformSettings',
    map: (doc) => ({
      id: toId(doc._id)!,
      singletonKey: toStr(doc.singletonKey, 'global'),
      rootAdminUserIds: toIds(doc.rootAdminUserIds),
      platformOwnerUserId: toId(doc.platformOwnerUserId),
      attendanceExcludedUserIds: toIds(doc.attendanceExcludedUserIds),
      qaExcludedUserIds: toIds(doc.qaExcludedUserIds),
      mailTemplateApproverUserIds: toIds(doc.mailTemplateApproverUserIds),
      autoProjectMemberUserIds: toIds(doc.autoProjectMemberUserIds),
      qaAdminUserId: toId(doc.qaAdminUserId),
      updatedBy: toId(doc.updatedBy),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
  },
  {
    tier: 2,
    key: 'projects',
    label: 'Project',
    mongoModelPath: 'models/Project.js',
    prismaDelegate: 'project',
    map: (doc) => ({
      id: toId(doc._id)!,
      tenantId: toId(doc.tenantId),
      name: toStr(doc.name),
      description: toOptStr(doc.description),
      outletId: toStr(doc.outletId),
      ownerId: toId(doc.owner)!,
      members: toIds(doc.members),
      memberRoles: toJson(doc.memberRoles),
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
      dependencies: toIds(doc.dependencies),
      createdById: toId(doc.createdBy),
      mentionAccessIds: toIds(doc.mentionAccessIds),
      notifiedOverdue: toBool(doc.notifiedOverdue),
      color: toOptStr(doc.color),
      createdAt: toDate(doc.createdAt) ?? new Date(),
      updatedAt: toDate(doc.updatedAt) ?? new Date(),
    }),
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
      exlyOfferings: toJson(doc.exlyOfferings),
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
      notes: toJson(doc.notes),
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
  // Notifications are local-only (device inbox) — not migrated to Postgres.
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
      const result = await delegate.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
      batch = [];
      process.stdout.write(`  … ${scanned}/${mongoCount} scanned, ${inserted} inserted\r`);
    }
  }

  if (batch.length > 0 && !dryRun) {
    const result = await delegate.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
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
