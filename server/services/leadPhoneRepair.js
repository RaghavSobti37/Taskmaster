const Lead = require('../models/Lead');
const { repairPhone, isCorruptLeadPhone, isValidPhone } = require('../utils/sanitizer');

const BYPASS = { bypassTenant: true };

const corruptPhoneQuery = {
  $or: [
    { phone: { $regex: /-DUP-[a-f0-9]{24}$/i } },
    { phone: { $regex: /^EMPTY-[a-f0-9]{24}$/i } },
  ],
};

/**
 * Repair phones corrupted by legacy dbPush duplicate resolution (-DUP-{id}, EMPTY-{id}).
 * Redundant duplicate rows (marked with -DUP-) are removed when a keeper with the same phone exists.
 */
async function repairCorruptLeadPhones() {
  const corruptLeads = await Lead.find(corruptPhoneQuery).setOptions(BYPASS).lean();
  const stats = { scanned: corruptLeads.length, repaired: 0, deleted: 0, skipped: 0, errors: [] };

  for (const lead of corruptLeads) {
    try {
      const repaired = repairPhone(lead.phone);
      const isDupMarked = /-DUP-[a-f0-9]{24}$/i.test(String(lead.phone));

      if (!repaired || !isValidPhone(repaired)) {
        stats.skipped += 1;
        continue;
      }

      const keeper = await Lead.findOne({
        tenantId: lead.tenantId,
        phone: repaired,
        _id: { $ne: lead._id },
      }).setOptions(BYPASS).select('_id').lean();

      if (keeper && isDupMarked) {
        await Lead.deleteOne({ _id: lead._id }).setOptions(BYPASS);
        stats.deleted += 1;
        continue;
      }

      if (keeper) {
        stats.skipped += 1;
        continue;
      }

      await Lead.updateOne({ _id: lead._id }, { $set: { phone: repaired } }).setOptions(BYPASS);
      stats.repaired += 1;
    } catch (err) {
      stats.errors.push(`${lead._id}: ${err.message}`);
    }
  }

  return stats;
}

module.exports = {
  corruptPhoneQuery,
  isCorruptLeadPhone,
  repairCorruptLeadPhones,
};
