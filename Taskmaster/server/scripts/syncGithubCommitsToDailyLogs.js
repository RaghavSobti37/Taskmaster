#!/usr/bin/env node
/**
 * Sync CoreKnot GitHub commits into DAILY_LOG rows using real Cursor session timings.
 *
 * Only inserts when ALL of these are true:
 * - Commit exists in local git history (after optional git fetch)
 * - Author email maps to a CoreKnot User
 * - Commit is matched to a Cursor agent transcript (SHA or commit message evidence)
 * - Session timing yields a positive duration (≥ 1 minute)
 *
 * Usage (from coreknot/Taskmaster/server):
 *   node scripts/syncGithubCommitsToDailyLogs.js --dry-run
 *   node scripts/syncGithubCommitsToDailyLogs.js --dry-run --since=all
 *   node scripts/syncGithubCommitsToDailyLogs.js --prod --yes --since=all
 *   node scripts/syncGithubCommitsToDailyLogs.js --prod --yes --owner-email=you@company.com
 *
 * Env: MONGODB_URI (local) / MONGODB_URI_PROD (--prod), ALLOW_PROD_DB_IN_DEV=true for prod from dev machine.
 * Optional: CURSOR_AGENT_TRANSCRIPTS_DIR, GITHUB_REPO (default: from git remote origin)
 */
const path = require('path');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const {
  getDbNameFromUri,
  assertSafeDbTarget,
  isProdLikeDbName,
} = require('../config/database');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const Log = require('../models/Log');
const User = require('../models/User');
const {
  normalizeDailyLogDetails,
  computeTimeSpentFromInterval,
} = require('../../shared/dailyLogDetails');
const { toDateKey } = require('../../shared/dateValidation');
const {
  loadAgentSessions,
  findSessionForCommit,
  allocateCommitInterval,
  dateToClockIST,
} = require('./lib/parseCursorAgentSessions');

const BYPASS = bypassOptions('GITHUB_COMMIT_DAILY_LOG_SYNC');
const DEFAULT_TRANSCRIPTS = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.cursor/projects/c-Users-ragha-OneDrive-Desktop-TSC-Platform/agent-transcripts',
);
const REPO_ROOT = path.resolve(__dirname, '../..');
function resolveGithubRepo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO.trim();
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/i);
    if (m) return m[1];
  } catch {
    // ponytail: local script; git remote is the source of truth when env unset
  }
  throw new Error('Set GITHUB_REPO or run from a git clone with origin remote');
}

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseSinceArg() {
  const raw = getArg('--since') || 'all';
  if (String(raw).toLowerCase() === 'all') return null;
  const m = String(raw).match(/^(\d+)(d|w)$/i);
  if (!m) throw new Error(`Invalid --since ${raw} (use all, 30d, or 4w)`);
  const n = parseInt(m[1], 10);
  const days = m[2].toLowerCase() === 'w' ? n * 7 : n;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  return since;
}

const BOT_AUTHOR_RE = /(dependabot|cursoragent|noreply|redacted@example\.com)/i;

function parseAuthorEmailsArg() {
  const raw = getArg('--author-emails') || process.env.GITHUB_DAILY_LOG_AUTHOR_EMAILS || '';
  return new Set(
    raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

function buildRow({ commit, user, detailsExtra, createdAt, githubRepo }) {
  const workDate = toDateKey(createdAt || commit.authorDate);
  const details = normalizeDailyLogDetails({
    type: 'GITHUB_COMMIT',
    title: commit.subject.slice(0, 200),
    message: [
      `Git commit ${commit.shortSha}`,
      `Author: ${commit.name} <${commit.email}>`,
      detailsExtra.message,
      `https://github.com/${githubRepo}/commit/${commit.sha}`,
    ].join('\n'),
    workDate,
    startTime: detailsExtra.startTime,
    endTime: detailsExtra.endTime,
    workspace: 'Engineering',
    project: 'CoreKnot',
    commitSha: commit.sha,
    commitShortSha: commit.shortSha,
    commitUrl: `https://github.com/${githubRepo}/commit/${commit.sha}`,
    authorEmail: commit.email,
    syncSource: 'github-commit-daily-log-sync',
    ...detailsExtra.fields,
  });

  return {
    userId: user._id,
    tenantId: user.tenantId,
    commit,
    details,
    createdAt: createdAt || commit.authorDate,
  };
}

function gitFetch() {
  if (hasFlag('--skip-fetch')) return;
  try {
    execFileSync('git', ['fetch', 'origin', '--prune'], { cwd: REPO_ROOT, stdio: 'pipe' });
  } catch (err) {
    console.warn('[sync] git fetch failed (continuing with local refs):', err.message);
  }
}

function loadGitCommits(sinceDate) {
  const format = '%H|%h|%ae|%an|%aI|%s';
  const args = ['log', '--all', '--no-merges', `--format=${format}`];
  if (sinceDate) args.push(`--since=${sinceDate.toISOString()}`);
  const out = execFileSync(
    'git',
    args,
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );

  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, shortSha, email, name, authorIso, ...subjectParts] = line.split('|');
    return {
      sha,
      shortSha,
      email: String(email).trim().toLowerCase(),
      name: name.trim(),
      authorDate: new Date(authorIso),
      subject: subjectParts.join('|').trim(),
    };
  }).filter((c) => c.sha && !Number.isNaN(c.authorDate.getTime()));
}

async function resolveOwnerUser(ownerEmail) {
  const email = String(ownerEmail).trim().toLowerCase();
  const user = await User.findOne({ email }).select('_id email name tenantId').setOptions(BYPASS).lean();
  if (!user) throw new Error(`No CoreKnot user for --owner-email ${email}`);
  return user;
}

function commitAuthorAllowed(commit, { ownerUser, authorEmails, userByEmail }) {
  if (BOT_AUTHOR_RE.test(commit.email)) return false;
  if (ownerUser) return authorEmails.has(commit.email);
  return userByEmail.has(commit.email);
}

function resolveLogUser(commit, { ownerUser, userByEmail }) {
  if (ownerUser) return ownerUser;
  return userByEmail.get(commit.email) || null;
}

function buildSessionSyncRows(commits, sessions, context, githubRepo) {
  const sessionCommits = new Map();

  for (const commit of commits) {
    if (!commitAuthorAllowed(commit, context)) continue;
    const user = resolveLogUser(commit, context);
    if (!user) continue;

    const hit = findSessionForCommit(commit, sessions);
    if (!hit) continue;

    const key = hit.session.id;
    if (!sessionCommits.has(key)) {
      sessionCommits.set(key, { session: hit.session, commits: [] });
    }
    sessionCommits.get(key).commits.push({ commit, user, matchType: hit.matchType });
  }

  const rows = [];

  for (const { session, commits: matched } of sessionCommits.values()) {
    matched.sort((a, b) => a.commit.authorDate - b.commit.authorDate);
    let prevAt = null;

    for (const { commit, user, matchType } of matched) {
      const interval = allocateCommitInterval(commit.authorDate, prevAt, session);
      prevAt = commit.authorDate;
      if (!interval) continue;

      rows.push(buildRow({
        commit,
        user,
        githubRepo,
        detailsExtra: {
          startTime: dateToClockIST(interval.startAt),
          endTime: dateToClockIST(interval.endAt),
          message: `Match: ${matchType} in Cursor session ${session.id}`,
          fields: {
            sessionId: session.id,
            sessionMatchType: matchType,
            timingSource: 'cursor-session',
          },
        },
      }));
    }
  }

  return rows;
}

/** Same-day git author timestamps — real gaps, no invented session wall clock. */
function buildGitChainSyncRows(commits, context, claimedShas, githubRepo) {
  const eligible = commits.filter((c) => {
    if (claimedShas.has(c.sha)) return false;
    if (!commitAuthorAllowed(c, context)) return false;
    return true;
  });

  const byDay = new Map();
  for (const commit of eligible) {
    const day = toDateKey(commit.authorDate);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(commit);
  }

  const rows = [];
  for (const dayCommits of byDay.values()) {
    dayCommits.sort((a, b) => a.authorDate - b.authorDate);
    let prevAt = null;
    for (const commit of dayCommits) {
      const user = resolveLogUser(commit, context);
      if (!user) continue;
      const interval = allocateCommitInterval(commit.authorDate, prevAt, { startAt: prevAt, endAt: null });
      prevAt = commit.authorDate;
      if (!interval) continue;

      rows.push(buildRow({
        commit,
        user,
        githubRepo,
        detailsExtra: {
          startTime: dateToClockIST(interval.startAt),
          endTime: dateToClockIST(interval.endAt),
          message: `Match: git author chain on ${toDateKey(commit.authorDate)}`,
          fields: {
            sessionMatchType: 'git-chain',
            timingSource: 'git-author-chain',
          },
        },
      }));
    }
  }

  return rows;
}

function buildSyncRows(commits, sessions, context, githubRepo) {
  const sessionRows = buildSessionSyncRows(commits, sessions, context, githubRepo);
  const claimed = new Set(sessionRows.map((r) => r.commit.sha));
  const chainRows = buildGitChainSyncRows(commits, context, claimed, githubRepo);
  return [...sessionRows, ...chainRows];
}

async function upsertRows(rows, dryRun) {
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const filter = {
      action: 'DAILY_LOG',
      'details.commitSha': row.details.commitSha,
      'details.syncSource': 'github-commit-daily-log-sync',
    };

    const existing = await Log.findOne(filter).setOptions(BYPASS).lean();
    const doc = {
      userId: row.userId,
      actorId: String(row.userId),
      origin: 'SYSTEM_AUTOMATION',
      action: 'DAILY_LOG',
      actionType: 'DAILY_LOG',
      status: 'SUCCESS',
      targetType: 'System',
      details: row.details,
      tenantId: row.tenantId,
      createdAt: row.createdAt,
      timestamp: row.createdAt,
    };

    if (dryRun) {
      if (existing) updated += 1;
      else inserted += 1;
      continue;
    }

    if (existing) {
      await Log.updateOne({ _id: existing._id }, { $set: doc }).setOptions(BYPASS);
      updated += 1;
    } else {
      await Log.create([doc], { ordered: true });
      inserted += 1;
    }
  }

  return { inserted, updated };
}

async function main() {
  const dryRun = hasFlag('--dry-run') || !hasFlag('--yes');
  const useProd = hasFlag('--prod');
  const transcriptsDir = getArg('--transcripts-dir')
    || process.env.CURSOR_AGENT_TRANSCRIPTS_DIR
    || DEFAULT_TRANSCRIPTS;
  const since = parseSinceArg();
  const ownerEmail = getArg('--owner-email') || process.env.GITHUB_DAILY_LOG_OWNER_EMAIL || null;

  if (useProd && !ownerEmail) {
    console.error('Production sync requires --owner-email or GITHUB_DAILY_LOG_OWNER_EMAIL.');
    process.exit(1);
  }

  if (useProd && !hasFlag('--yes') && !dryRun) {
    console.error('Production write requires --yes (or use --dry-run first).');
    process.exit(1);
  }

  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || '').trim()
    : (process.env.MONGODB_URI || '').trim();

  if (!uri) {
    console.error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
    process.exit(1);
  }

  const source = useProd ? 'production' : 'development';
  assertSafeDbTarget(uri, { source });

  if (useProd && isProdLikeDbName(getDbNameFromUri(uri)) && process.env.ALLOW_PROD_DB_IN_DEV !== 'true' && process.env.NODE_ENV !== 'production') {
    console.error('Set ALLOW_PROD_DB_IN_DEV=true to write GitHub commit logs to production from a dev machine.');
    process.exit(1);
  }

  gitFetch();
  const githubRepo = resolveGithubRepo();
  const commits = loadGitCommits(since);
  const sessions = loadAgentSessions(transcriptsDir, { includeSubagents: false });

  console.log(JSON.stringify({
    phase: 'collect',
    repo: REPO_ROOT,
    github: githubRepo,
    since: since ? since.toISOString() : 'all',
    ownerEmail,
    commits: commits.length,
    sessions: sessions.length,
    transcriptsDir,
    dryRun,
    target: source,
  }, null, 2));

  await mongoose.connect(uri);

  const ownerUser = ownerEmail ? await resolveOwnerUser(ownerEmail) : null;
  let authorEmails = parseAuthorEmailsArg();
  if (ownerUser && authorEmails.size === 0) {
    authorEmails = new Set(
      commits
        .map((c) => c.email)
        .filter((email) => email && !BOT_AUTHOR_RE.test(email)),
    );
  }

  const userByEmail = new Map();
  if (ownerUser) {
    userByEmail.set(ownerUser.email.toLowerCase(), ownerUser);
  } else {
    const users = await User.find({}).select('_id email name tenantId').setOptions(BYPASS).lean();
    for (const u of users) userByEmail.set(String(u.email).toLowerCase(), u);
  }

  const context = { ownerUser, authorEmails, userByEmail };
  const rows = buildSyncRows(commits, sessions, context, githubRepo);

  const eligibleCommits = commits.filter((c) => commitAuthorAllowed(c, context));
  const unmatchedUser = commits.length - eligibleCommits.length;
  const matchedNoTiming = eligibleCommits.length - rows.length;

  const stats = await upsertRows(rows, dryRun);

  const sample = rows.slice(0, 5).map((r) => ({
    sha: r.commit.shortSha,
    subject: r.commit.subject,
    workDate: r.details.workDate,
    interval: `${r.details.startTime}–${r.details.endTime}`,
    timeSpent: r.details.timeSpent,
    sessionId: r.details.sessionId,
  }));

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    target: source,
    db: getDbNameFromUri(uri),
    commitsScanned: commits.length,
    sessionsLoaded: sessions.length,
    ownerUserId: ownerUser ? String(ownerUser._id) : null,
    authorEmails: [...authorEmails],
    commitsEligible: eligibleCommits.length,
    commitsSkippedNotOwnerAuthor: unmatchedUser,
    commitsSkippedNoTiming: matchedNoTiming,
    rowsReady: rows.length,
    sessionRows: rows.filter((r) => r.details.timingSource === 'cursor-session').length,
    gitChainRows: rows.filter((r) => r.details.timingSource === 'git-author-chain').length,
    ...stats,
    sample,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
