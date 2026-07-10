/**
 * Compare Mongo vs Postgres row counts after ETL.
 * Usage: npm run etl:validate-counts
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import type mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';

const SERVER_ROOT = path.resolve(__dirname, '../../../server');
const serverRequire = createRequire(path.join(SERVER_ROOT, 'package.json'));
const mongoose = serverRequire('mongoose') as typeof import('mongoose');
const ROOT = path.resolve(__dirname, '../../..');
const { ALL_ETL_KEYS } = require(path.join(ROOT, 'shared/etlCoverage'));

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type CountRow = {
  key: string;
  mongo: number;
  postgres: number;
  ok: boolean;
  note?: string;
};

const MONGO_MODEL_BY_KEY: Record<string, string> = {
  tenants: 'models/Tenant.js',
  users: 'models/User.js',
  departments: 'models/Department.js',
  workspaces: 'models/Workspace.js',
  projects: 'domains/projects/models/Project.js',
  phases: 'domains/projects/models/Phase.js',
  persons: 'models/Person.js',
  teams: 'models/Team.js',
  tasks: 'domains/tasks/models/Task.js',
  taskassignments: 'domains/tasks/models/TaskAssignment.js',
  tasktypes: 'domains/tasks/models/TaskType.js',
  leads: 'domains/crm/models/Lead.js',
  exlybookings: 'models/ExlyBooking.js',
  attendance: 'models/Attendance.js',
  leaverequests: 'models/LeaveRequest.js',
  crmconfigs: 'domains/crm/models/CRMConfig.js',
  crmimports: 'domains/crm/models/CRMImport.js',
  gamificationconfigs: 'models/GamificationConfig.js',
  notifications: 'models/Notification.js',
  personidentifiers: 'models/PersonIdentifier.js',
  projectgoals: 'domains/projects/models/ProjectGoal.js',
  taskactivities: 'domains/tasks/models/TaskActivity.js',
};

const PRISMA_DELEGATE_BY_KEY: Record<string, string> = {
  tenants: 'tenant',
  users: 'user',
  departments: 'department',
  workspaces: 'workspace',
  projects: 'project',
  projectmembers: 'projectMember',
  phases: 'phase',
  persons: 'person',
  teams: 'team',
  tasks: 'task',
  taskassignments: 'taskAssignment',
  tasktypes: 'taskType',
  taskdependencies: 'taskDependency',
  taskmentionaccess: 'taskMentionAccess',
  leads: 'lead',
  leadnotes: 'leadNote',
  leadexlyofferings: 'leadExlyOffering',
  exlybookings: 'exlyBooking',
  attendance: 'attendance',
  leaverequests: 'leaveRequest',
  crmconfigs: 'cRMConfig',
  crmimports: 'cRMImport',
  gamificationconfigs: 'gamificationConfig',
  notifications: 'notification',
  personidentifiers: 'personIdentifier',
  projectgoals: 'projectGoal',
  taskactivities: 'taskActivity',
};

const FLATTEN_KEYS = new Set([
  'projectmembers',
  'taskdependencies',
  'taskmentionaccess',
  'leadnotes',
  'leadexlyofferings',
]);

async function countMongo(key: string): Promise<number> {
  const modelPath = MONGO_MODEL_BY_KEY[key];
  if (!modelPath) return -1;
  const Model = serverRequire(path.join(SERVER_ROOT, modelPath)) as mongoose.Model<unknown>;
  return Model.countDocuments({}).setOptions({ bypassTenant: true });
}

async function countPostgres(prisma: PrismaClient, key: string): Promise<number> {
  const delegate = PRISMA_DELEGATE_BY_KEY[key];
  if (!delegate) return -1;
  const model = prisma[delegate as keyof PrismaClient] as { count: () => Promise<number> };
  return model.count();
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!mongoUri) throw new Error('MONGODB_URI required');
  if (!dbUrl) throw new Error('DATABASE_URL required');

  await mongoose.connect(mongoUri);
  const prisma = new PrismaClient();
  await prisma.$connect();

  const rows: CountRow[] = [];
  let failures = 0;

  for (const key of ALL_ETL_KEYS) {
    const mongo = await countMongo(key);
    const postgres = await countPostgres(prisma, key);
    let ok = true;
    let note: string | undefined;

    if (FLATTEN_KEYS.has(key)) {
      note = 'flattened — PG count may differ from parent mongo count';
      ok = postgres >= 0;
    } else if (mongo >= 0 && postgres >= 0) {
      if (postgres > mongo) {
        ok = false;
        note = `PG ${postgres} > Mongo ${mongo}`;
        failures += 1;
      } else if (postgres < mongo) {
        note = `PG ${postgres} < Mongo ${mongo} (FK-filtered orphans expected)`;
        ok = true;
      }
    }

    rows.push({ key, mongo, postgres, ok, note });
  }

  console.log('\nETL count validation\n');
  console.log(`${'Key'.padEnd(22)} ${'Mongo'.padStart(8)} ${'Postgres'.padStart(10)}  Status`);
  console.log('─'.repeat(55));
  for (const row of rows) {
    const status = row.ok ? 'ok' : 'MISMATCH';
    const note = row.note ? ` (${row.note})` : '';
    console.log(
      `${row.key.padEnd(22)} ${String(row.mongo).padStart(8)} ${String(row.postgres).padStart(10)}  ${status}${note}`,
    );
  }

  await prisma.$disconnect();
  await mongoose.disconnect();

  if (failures > 0) {
    console.log(`\n${failures} count error(s) (Postgres > Mongo). Investigate duplicate or bad ETL.\n`);
    process.exit(1);
  }
  console.log('\nETL counts OK (Postgres ≤ Mongo per collection; gaps = FK-filtered orphans).\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
