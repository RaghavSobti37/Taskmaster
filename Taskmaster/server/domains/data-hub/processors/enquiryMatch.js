const { parseEnquiryDescription } = require('../queryHelpers');

function enquiryMatchesContact(task, contact) {
  const parsed = parseEnquiryDescription(task.description);
  const eMatch = contact.email && parsed.email?.toLowerCase() === contact.email.toLowerCase();
  const pMatch = contact.phone && parsed.phone === contact.phone;
  return eMatch || pMatch
    || (task.description || '').includes(contact.email || '')
    || (task.description || '').includes(contact.phone || '');
}

function filterEnquiriesForContact(enquiryTasks, contact) {
  return enquiryTasks.filter((t) => enquiryMatchesContact(t, contact));
}

module.exports = {
  enquiryMatchesContact,
  filterEnquiriesForContact,
};
