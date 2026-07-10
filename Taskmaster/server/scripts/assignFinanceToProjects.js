#!/usr/bin/env node

/**
 * Assign finance documents to projects using title/filename/vendor/OCR text.
 * Uncertain matches go to GENERAL (or GENERAL ADMINISTRATION if it exists).
 *
 * Usage:
 *   node server/scripts/assignFinanceToProjects.js --local
 *   node server/scripts/assignFinanceToProjects.js --prod
 *   node server/scripts/assignFinanceToProjects.js --local --dry-run
 *   node server/scripts/assignFinanceToProjects.js --local --only-unassigned
 *   node server/scripts/assignFinanceToProjects.js --prod --rematch-general
 *   node server/scripts/assignFinanceToProjects.js --prod --rematch-all
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const User = require('../models/User');
const { formatProjectName } = require('../utils/formatProjectName');
const {
  matchFinanceDocToProject,
  resolveFinanceCategory,
  isGeneralProjectName,
  buildProjectMatchers,
  scoreProjectMatch,
  MATCH_THRESHOLD,
} = require('../../shared/financeProjectMatcher');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RUN_LOCAL = args.includes('--local') || (!args.includes('--prod') && !args.includes('--all'));
const RUN_PROD = args.includes('--prod') || args.includes('--all');
const ONLY_UNASSIGNED = args.includes('--only-unassigned');
const REMATCH_ALL = args.includes('--rematch-all');
const REMATCH_GENERAL = args.includes('--rematch-general') || REMATCH_ALL;

const BYPASS = { bypassTenant: true };

async function getOrCreateGeneralProject(adminUser, tenantId) {
  const existing = await Project.findOne({
    name: { $in: ['GENERAL', 'GENERAL ADMINISTRATION'] },
  }).setOptions(BYPASS).lean();

  if (existing) return existing;

  const name = formatProjectName('General');
  console.log(`Creating fallback project: ${name}`);
  if (DRY_RUN) {
    return { _id: new mongoose.Types.ObjectId(), name };
  }

  const project = new Project({
    name,
    description: 'Shared overhead and unassigned finance documents',
    outletId: adminUser.currentOutletId || 'main',
    owner: adminUser._id,
    members: [adminUser._id],
    status: 'active',
    workspace: 'General',
    tenantId,
  });
  await project.save();
  return project;
}

async function loadFolderNames(docs) {
  const folderIds = [...new Set(
    docs.map((d) => d.folderId?.toString?.() || d.folderId).filter(Boolean)
  )];
  if (!folderIds.length) return new Map();

  const folders = await FinanceDocument.find({
    _id: { $in: folderIds },
    isFolder: true,
  }).select('_id folderName title').lean();

  return new Map(folders.map((f) => [f._id.toString(), f.folderName || f.title || '']));
}

async function assignOnDatabase(label, uri) {
  console.log(`\n=== ${label.toUpperCase()} ===`);
  await mongoose.connect(uri);

  let adminUser = await User.findOne({ role: 'admin' }).setOptions(BYPASS);
  if (!adminUser) adminUser = await User.findOne({}).setOptions(BYPASS);
  if (!adminUser) throw new Error('No users found — seed an admin user first.');

  const tenantId = adminUser.tenantId || new mongoose.Types.ObjectId();
  const generalProject = await getOrCreateGeneralProject(adminUser, tenantId);
  const generalProjectId = generalProject._id.toString();

  const projects = await Project.find({}).setOptions(BYPASS).select('name').lean();
  const nonGeneralProjects = projects.filter((p) => !isGeneralProjectName(p.name));
  const validProjectIds = new Set(projects.map((p) => p._id.toString()));
  const matchers = buildProjectMatchers(nonGeneralProjects);

  const filter = { isFolder: { $ne: true } };
  if (ONLY_UNASSIGNED) filter.project = { $in: [null, undefined] };

  const docs = await FinanceDocument.find(filter)
    .select('title fileName description category metadata extractedText project folderId')
    .setOptions(BYPASS)
    .lean();

  const folderNames = await loadFolderNames(docs);

  const stats = {
    scanned: docs.length,
    projectUpdated: 0,
    categoryUpdated: 0,
    kept: 0,
    matched: 0,
    general: 0,
    unchanged: 0,
    samples: { matched: [], general: [] },
  };

  for (const doc of docs) {
    const folderName = folderNames.get(doc.folderId?.toString?.() || '') || '';
    const currentProjectId = doc.project?.toString?.() || doc.project || null;
    const onGeneral = currentProjectId === generalProjectId;
    const orphanProject = Boolean(currentProjectId && !validProjectIds.has(currentProjectId));
    const titleText = [doc.title, doc.fileName, folderName].filter(Boolean).join(' ');
    const currentMatcher = matchers.find((m) => m.id === currentProjectId);
    const titleScoreCurrent = currentMatcher ? scoreProjectMatch(titleText, currentMatcher) : 0;
    const weakAssignment = Boolean(
      currentProjectId
      && !onGeneral
      && !orphanProject
      && titleScoreCurrent < MATCH_THRESHOLD
    );
    const needsGeneralRematch = onGeneral || orphanProject || weakAssignment;
    const forceRematch = REMATCH_ALL || (REMATCH_GENERAL && needsGeneralRematch);

    const match = matchFinanceDocToProject(doc, nonGeneralProjects, {
      generalProjectId,
      folderName,
      ignoreExisting: forceRematch,
      requireTitleMatch: REMATCH_ALL || needsGeneralRematch,
    });

    const nextCategory = resolveFinanceCategory(doc);
    const updates = {};

    if (match.projectId && match.projectId !== currentProjectId) {
      updates.project = match.projectId;
      stats.projectUpdated += 1;
      if (match.confidence === 'matched') stats.matched += 1;
      if (match.confidence === 'general') stats.general += 1;
    } else if (match.confidence === 'keep') {
      stats.kept += 1;
    } else {
      stats.unchanged += 1;
    }

    if (nextCategory !== (doc.category || 'other')) {
      updates.category = nextCategory;
      stats.categoryUpdated += 1;
    }

    if (!Object.keys(updates).length) continue;

    if (match.confidence === 'matched' && stats.samples.matched.length < 8) {
      stats.samples.matched.push({
        title: doc.title || doc.fileName,
        from: currentProjectId,
        to: match.projectName,
        score: match.score,
      });
    }
    if (match.confidence === 'general' && stats.samples.general.length < 8) {
      stats.samples.general.push({
        title: doc.title || doc.fileName,
        score: match.score,
      });
    }

    if (DRY_RUN) continue;
    await FinanceDocument.updateOne({ _id: doc._id }, { $set: updates });
  }

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    onlyUnassigned: ONLY_UNASSIGNED,
    rematchAll: REMATCH_ALL,
    rematchGeneral: REMATCH_GENERAL,
    generalProject: { id: generalProjectId, name: generalProject.name },
    ...stats,
  }, null, 2));

  await mongoose.disconnect();
}

(async () => {
  try {
    if (RUN_LOCAL && process.env.MONGODB_URI) {
      await assignOnDatabase('local', process.env.MONGODB_URI);
    }
    if (RUN_PROD && process.env.MONGODB_URI_PROD) {
      await assignOnDatabase('production', process.env.MONGODB_URI_PROD);
    }
    if (!RUN_LOCAL && !RUN_PROD) {
      console.error('Pass --local and/or --prod');
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
