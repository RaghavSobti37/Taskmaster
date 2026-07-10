const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const CRMAudit = require('../models/CRMAudit');
const { repairPhone, isCorruptLeadPhone, isValidPhone, phoneDigitCount } = require('../utils/sanitizer');

const BYPASS = { bypassTenant: true };

const corruptPhoneQuery = {
  $or: [
    { phone: { $regex: /-DUP-[a-f0-9]{24}$/i } },
    { phone: { $regex: /^EMPTY-[a-f0-9]{24}$/i } },
    // Indian mobiles are + + 12 digits; anything longer is concatenated garbage
    { phone: { $regex: /^\+[0-9]{13,}/ } },
  ],
};

async function repairContactPhone(contactId, repaired) {
  if (!repaired) return;
  await Contact.updateOne({ _id: contactId }, { $set: { phone: repaired } }).setOptions(BYPASS);
}

/**
 * Repair phones corrupted by legacy dbPush (-DUP-{id}, EMPTY-{id}) or concatenated digit blobs.
 * When a valid keeper already exists, the corrupt duplicate row is removed.
 */
async function repairCorruptLeadPhones() {
  const corruptLeads = await Lead.find(corruptPhoneQuery).setOptions(BYPASS).lean();
  const stats = { scanned: corruptLeads.length, repaired: 0, deleted: 0, skipped: 0, contactsFixed: 0, errors: [] };

  for (const lead of corruptLeads) {
    try {
      const repaired = repairPhone(lead.phone);
      const isDupMarked = /-DUP-[a-f0-9]{24}$/i.test(String(lead.phone));

      if (!repaired || !isValidPhone(repaired)) {
        stats.skipped += 1;
        stats.errors.push(`${lead._id}: cannot extract valid phone from "${lead.phone}"`);
        continue;
      }

      const keeper = await Lead.findOne({
        tenantId: lead.tenantId,
        phone: repaired,
        _id: { $ne: lead._id },
      }).setOptions(BYPASS).select('_id email name').lean();

      if (keeper && (isDupMarked || isCorruptLeadPhone(lead.phone))) {
        await Promise.all([
          Lead.deleteOne({ _id: lead._id }).setOptions(BYPASS),
          CRMAudit.deleteMany({ leadId: lead._id }).setOptions(BYPASS),
        ]);
        stats.deleted += 1;
        continue;
      }

      if (keeper) {
        stats.skipped += 1;
        continue;
      }

      await Lead.updateOne({ _id: lead._id }, { $set: { phone: repaired } }).setOptions(BYPASS);
      stats.repaired += 1;

      const contact = await Contact.findOne({
        $or: [
          ...(lead.email ? [{ email: lead.email }] : []),
          { phone: lead.phone },
        ],
      }).setOptions(BYPASS).select('_id phone').lean();
      if (contact && isCorruptLeadPhone(contact.phone)) {
        await repairContactPhone(contact._id, repaired);
        stats.contactsFixed += 1;
      }
    } catch (err) {
      stats.errors.push(`${lead._id}: ${err.message}`);
    }
  }

  // Contacts with corrupt phones not tied to a lead row above
  const corruptContacts = await Contact.find({
    $or: [
      { phone: { $regex: /-DUP-[a-f0-9]{24}$/i } },
      { phone: { $regex: /^EMPTY-[a-f0-9]{24}$/i } },
      { phone: { $regex: /^\+[0-9]{13,}/ } },
    ],
  }).setOptions(BYPASS).select('_id phone email').lean();

  for (const contact of corruptContacts) {
    try {
      const repaired = repairPhone(contact.phone);
      if (!repaired || !isValidPhone(repaired)) {
        stats.skipped += 1;
        continue;
      }
      const keeper = await Contact.findOne({
        phone: repaired,
        _id: { $ne: contact._id },
      }).setOptions(BYPASS).select('_id').lean();
      if (keeper) {
        await Contact.deleteOne({ _id: contact._id }).setOptions(BYPASS);
        stats.deleted += 1;
      } else {
        await repairContactPhone(contact._id, repaired);
        stats.contactsFixed += 1;
      }
    } catch (err) {
      stats.errors.push(`contact ${contact._id}: ${err.message}`);
    }
  }

  return stats;
}

module.exports = {
  corruptPhoneQuery,
  isCorruptLeadPhone,
  repairCorruptLeadPhones,
};
