const Contact = require('../models/Contact');
const { sanitizeEmail, normalizePhone, sanitizeName } = require('../utils/sanitizer');

class ContactService {
  /**
   * Upserts a contact combining data from different sources to ensure no duplicates.
   */
  async mergeContact(data, source = 'crm') {
    const email = sanitizeEmail(data.email);
    const phone = normalizePhone(data.phone);
    const name = sanitizeName(data.name || 'Anonymous');

    if (!email && !phone) return null;

    const filter = { $or: [] };
    if (email) filter.$or.push({ email });
    if (phone) filter.$or.push({ phone });

    const updatePayload = {
      $set: {},
      $addToSet: {}
    };

    if (name && name !== 'Anonymous') updatePayload.$set.name = name;
    if (email) updatePayload.$set.email = email;
    if (phone) updatePayload.$set.phone = phone;

    if (source === 'crm') {
      updatePayload.$set.inCRM = true;
      if (data.leadStatus) updatePayload.$set.leadStatus = data.leadStatus;
      if (data.leadQuality) updatePayload.$set.leadQuality = data.leadQuality;
    } else if (source === 'exly') {
      updatePayload.$set.inExly = true;
      if (data.exlyOfferingTitle) {
        updatePayload.$addToSet.exlyOfferings = data.exlyOfferingTitle;
      }
    } else if (source === 'mailer') {
      updatePayload.$set.inMailer = true;
      if (data.emailStatus) updatePayload.$set.emailStatus = data.emailStatus;
    }

    if (Object.keys(updatePayload.$addToSet).length === 0) {
      delete updatePayload.$addToSet;
    }

    return await Contact.findOneAndUpdate(
      filter,
      updatePayload,
      { upsert: true, new: true, runValidators: true }
    );
  }
}

module.exports = new ContactService();
