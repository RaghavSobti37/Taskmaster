#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const { rollupFinanceByProject } = require('../../shared/projectFinanceRollup');
const { resolveRollingRange } = require('../../shared/reportRange');

const BYPASS = { bypassTenant: true };

async function run() {
  const isLocal = process.argv.includes('--local');
  const uri = isLocal ? process.env.MONGODB_URI : process.env.MONGODB_URI_PROD;
  const label = isLocal ? 'local' : 'production';

  await mongoose.connect(uri);
  const window = resolveRollingRange({ timeframe: '30d' });
  const rangeStart = new Date(`${window.startKey}T00:00:00`);
  const rangeEnd = new Date(`${window.endKey}T23:59:59`);

  const docs = await FinanceDocument.find({ isFolder: { $ne: true } })
    .select('project category metadata createdAt title')
    .setOptions(BYPASS)
    .lean();
  const projects = await Project.find({}).select('name').setOptions(BYPASS).lean();
  const byProject = rollupFinanceByProject(docs, rangeStart, rangeEnd);
  const projectNames = Object.fromEntries(projects.map((p) => [p._id.toString(), p.name]));

  const withActivity = [...byProject.entries()]
    .filter(([, v]) => v.spentTotal > 0 || v.budget > 0 || v.revenueTotal > 0)
    .sort((a, b) => b[1].spentTotal - a[1].spentTotal);

  console.log(`=== ${label} ===`);
  console.log('Window:', window.startKey, '->', window.endKey);
  console.log('Total docs:', docs.length);
  console.log('Docs with amount>0:', docs.filter((d) => (d.metadata?.amount || 0) > 0).length);
  console.log('Docs with project:', docs.filter((d) => d.project).length);
  console.log('Projects with finance:', withActivity.length);

  withActivity.slice(0, 20).forEach(([pid, row]) => {
    console.log(projectNames[pid] || pid, {
      budget: row.budget,
      spentTotal: row.spentTotal,
      spentInRange: row.spentInRange,
      revenueInRange: row.revenueInRange,
      cats: row.spendByCategory,
    });
  });

  const totals = { budget: 0, spentTotal: 0, spentInRange: 0, revenueInRange: 0 };
  withActivity.forEach(([, row]) => {
    totals.budget += row.budget;
    totals.spentTotal += row.spentTotal;
    totals.spentInRange += row.spentInRange;
    totals.revenueInRange += row.revenueInRange;
  });
  console.log('Totals:', totals);

  const noAmount = docs.filter((d) => !(d.metadata?.amount > 0)).length;
  const noDate = docs.filter((d) => (d.metadata?.amount > 0) && !d.metadata?.date && !d.createdAt).length;
  console.log('Docs missing amount:', noAmount);
  console.log('Docs with amount but no date:', noDate);

  const general = projects.find((p) => /^general/i.test(p.name));
  if (general) {
    const gid = general._id.toString();
    const generalDocs = docs.filter((d) => (d.project?.toString?.() || d.project) === gid);
    const generalWithAmount = generalDocs.filter((d) => (d.metadata?.amount || 0) > 0);
    console.log('GENERAL project docs:', generalDocs.length, 'with amount:', generalWithAmount.length);
  }

  const categoryCounts = {};
  docs.forEach((d) => {
    const cat = d.category || 'other';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  console.log('By category:', categoryCounts);

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
