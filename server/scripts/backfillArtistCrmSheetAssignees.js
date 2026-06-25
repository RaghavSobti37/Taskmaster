/**
 * Re-assign artist CRM leads imported from Google Sheets using canonical sheet→rep rules.
 *
 *   node scripts/backfillArtistCrmSheetAssignees.js --dry-run
 *   node scripts/backfillArtistCrmSheetAssignees.js --prod
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { CRM_TYPES } = require('../../shared/artistCrmTaxonomy');
const { googleSheetSourceForTab } = require('../../shared/artistCrmSheetAssignees');
const { matchAssigneeFromSheetName, listArtistCallAssignees } = require('../utils/artistCallAssignees');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const TENANT_LOOKUP = bypassOptions('artist_sheet_assignee_backfill');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    prod: args.includes('--prod'),
    sheet: (() => {
      const i = args.indexOf('--sheet');
      return i >= 0 ? args[i + 1] : null;
    })(),
  };
}

function sheetNameFromSource(source) {
  const prefix = 'Google Sheet: ';
  if (!String(source || '').startsWith(prefix)) return null;
  return source.slice(prefix.length).trim();
}

async function main() {
  const { dryRun, prod, sheet } = parseArgs();
  const uri = prod ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  const assignees = await listArtistCallAssignees();

  const query = {
    crmType: CRM_TYPES.ARTIST,
    source: { $regex: /^Google Sheet:/ },
  };
  if (sheet) {
    query.source = googleSheetSourceForTab(sheet);
  }

  const leads = await Lead.find(query)
    .select('_id name source assignedRepId')
    .setOptions(TENANT_LOOKUP)
    .lean();

  let updated = 0;
  let skipped = 0;
  const bySheet = {};

  for (const lead of leads) {
    const tabName = sheetNameFromSource(lead.source);
    if (!tabName) {
      skipped++;
      continue;
    }

    const resolved = matchAssigneeFromSheetName(tabName, assignees);
    if (!resolved?.assigneeId) {
      skipped++;
      continue;
    }

    if (String(lead.assignedRepId) === String(resolved.assigneeId)) {
      skipped++;
      continue;
    }

    bySheet[tabName] = bySheet[tabName] || { to: resolved.assigneeName, count: 0 };
    bySheet[tabName].count++;

    if (!dryRun) {
      await Lead.updateOne(
        { _id: lead._id },
        { $set: { assignedRepId: resolved.assigneeId } },
      ).setOptions(TENANT_LOOKUP);
    }
    updated++;
  }

  console.log(JSON.stringify({
    dryRun,
    prod,
    scanned: leads.length,
    updated,
    skipped,
    bySheet,
    assignees: assignees.map((a) => ({ id: a._id, name: a.name })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
