#!/usr/bin/env node
/**
 * Verify local NestJS + Postgres migration (no production writes).
 * Usage: npm run local:verify
 */
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../nestjs-server/.env') });

const NEST_URL = process.env.LOCAL_NEST_URL || 'http://127.0.0.1:5001';

function fail(msg) {
  console.error(`  [FAIL] ${msg}`);
  return false;
}

function pass(msg, detail = '') {
  console.log(`  [PASS] ${msg}${detail ? ` — ${detail}` : ''}`);
  return true;
}

async function main() {
  console.log('\n=== Local migration verification ===\n');
  let ok = true;

  const serverJwt = process.env.JWT_SECRET;
  const nestEnv = require('fs').readFileSync(
    path.join(__dirname, '../../nestjs-server/.env'),
    'utf8',
  );
  const nestJwt = (nestEnv.match(/^JWT_SECRET=(.*)$/m) || [])[1]?.trim();

  if (!serverJwt || !nestJwt || serverJwt !== nestJwt) {
    ok = fail('JWT_SECRET must match in server/.env and nestjs-server/.env') && ok;
  } else {
    pass('JWT_SECRET aligned between Express and Nest');
  }

  const healthRes = await fetch(`${NEST_URL}/api/health`);
  if (!healthRes.ok) {
    ok = fail(`Nest health HTTP ${healthRes.status}`) && ok;
  } else {
    const health = await healthRes.json();
    if (!health.ok || health.dependencies?.postgres?.ok !== true) {
      ok = fail('Nest health reports Postgres not connected') && ok;
    } else {
      pass('Nest /api/health + Postgres connected');
    }
  }

  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    await prisma.$connect();

    const counts = {
      users: await prisma.user.count(),
      projects: await prisma.project.count(),
      tasks: await prisma.task.count(),
      assignments: await prisma.taskAssignment.count(),
      attendance: await prisma.attendance.count(),
    };

    if (counts.users === 0 || counts.tasks === 0) {
      ok = fail('Postgres empty — run npm run local:setup') && ok;
    } else {
      pass('Postgres has operational data', JSON.stringify(counts));
    }

    const user = await prisma.user.findFirst({ select: { id: true, tenantId: true } });
    const task = await prisma.task.findFirst({
      where: user?.tenantId ? { tenantId: user.tenantId } : undefined,
      select: { id: true },
    });

    if (user && task && serverJwt) {
      const token = jwt.sign(
        { id: user.id, loginAt: Math.floor(Date.now() / 1000) },
        serverJwt,
        { expiresIn: '1h' },
      );
      const taskRes = await fetch(`${NEST_URL}/api/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!taskRes.ok) {
        ok = fail(`GET /api/tasks/:id returned ${taskRes.status}`) && ok;
      } else {
        const body = await taskRes.json();
        if (body._readSource !== 'supabase-prisma') {
          ok = fail('Task read missing _readSource=supabase-prisma') && ok;
        } else {
          pass('Authenticated task read from Postgres', task.id);
        }
      }

      const attRes = await fetch(`${NEST_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (attRes.status !== 200) {
        ok = fail(`GET /api/attendance returned ${attRes.status}`) && ok;
      } else {
        pass('Authenticated attendance list from Postgres');
      }
    }

    await prisma.$disconnect();
  } catch (err) {
    ok = fail(`Prisma check failed: ${err.message}`) && ok;
    if (prisma) await prisma.$disconnect().catch(() => {});
  }

  console.log(`\nResult: ${ok ? 'READY for local strangler dev' : 'NOT READY — fix items above'}\n`);
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
