/**
 * Bulk reassign CRM leads between reps by name.
 * Usage: node server/scripts/reassignLeadsBetweenReps.js <fromName> <toName> [--crm-type=artist|sales|all] [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');

const BYPASS = { bypassTenant: true };

async function findUserByName(fragment) {
  const pattern = new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const matches = await User.find({ name: pattern }).setOptions(BYPASS).lean();
  if (matches.length === 0) {
    const byEmail = await User.find({ email: pattern }).setOptions(BYPASS).lean();
    return byEmail;
  }
  return matches;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const crmTypeArg = process.argv.find((a) => a.startsWith('--crm-type='));
  const crmType = crmTypeArg ? crmTypeArg.split('=')[1] : 'all';

  const [fromName, toName] = args;
  if (!fromName || !toName) {
    console.error('Usage: node reassignLeadsBetweenReps.js <fromName> <toName> [--crm-type=artist|sales|all] [--dry-run]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const fromMatches = await findUserByName(fromName);
  const toMatches = await findUserByName(toName);

  if (fromMatches.length !== 1) {
    console.error('From user matches:', fromMatches.map((u) => `${u.name} <${u.email}>`));
    process.exit(1);
  }
  if (toMatches.length !== 1) {
    console.error('To user matches:', toMatches.map((u) => `${u.name} <${u.email}>`));
    process.exit(1);
  }

  const fromUser = fromMatches[0];
  const toUser = toMatches[0];

  const query = { assignedRepId: fromUser._id };
  if (crmType !== 'all') query.crmType = crmType;

  const count = await Lead.countDocuments(query).setOptions(BYPASS);
  const breakdown = await Lead.aggregate([
    { $match: query },
    { $group: { _id: { crmType: '$crmType', contactCategory: '$contactCategory' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).option(BYPASS);

  console.log(`From: ${fromUser.name} (${fromUser._id})`);
  console.log(`To:   ${toUser.name} (${toUser._id})`);
  console.log(`Filter: crmType=${crmType}`);
  console.log(`Leads to reassign: ${count}`);
  console.log('Breakdown:', breakdown);

  if (dryRun) {
    console.log('Dry run — no changes made.');
    await mongoose.disconnect();
    return;
  }

  if (count === 0) {
    console.log('Nothing to update.');
    await mongoose.disconnect();
    return;
  }

  const result = await Lead.updateMany(query, { $set: { assignedRepId: toUser._id } }).setOptions(BYPASS);
  console.log(`Updated ${result.modifiedCount} leads.`);

  const remaining = await Lead.countDocuments({ assignedRepId: fromUser._id }).setOptions(BYPASS);
  const akashTotal = await Lead.countDocuments({ assignedRepId: toUser._id }).setOptions(BYPASS);
  console.log(`${fromUser.name} remaining: ${remaining}`);
  console.log(`${toUser.name} total assigned: ${akashTotal}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
