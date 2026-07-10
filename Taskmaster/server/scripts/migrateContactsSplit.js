/**
 * Split legacy contacts collection into personindexes + officecontacts.
 * Run: node server/scripts/migrateContactsSplit.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const OFFICE_ROLE_RE = /^(?!customer$)(?!Customer$).+/;

async function main({ embedded = false } = {}) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!embedded) {
    if (!uri) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(uri);
  }

  const db = mongoose.connection.db;
  const legacy = db.collection('contacts');
  const personIdx = db.collection('personindexes');
  const office = db.collection('officecontacts');

  const existingPerson = await personIdx.countDocuments();
  const existingOffice = await office.countDocuments();
  if (existingPerson > 0 || existingOffice > 0) {
    console.log(`skip — personindexes=${existingPerson} officecontacts=${existingOffice}`);
    if (!embedded) await mongoose.disconnect();
    return;
  }

  const cursor = legacy.find({});
  let personCount = 0;
  let officeCount = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const role = doc.role;
    const isOffice = role && OFFICE_ROLE_RE.test(String(role));

    if (isOffice) {
      await office.insertOne({
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        role: doc.role,
        notes: doc.notes,
        addedBy: doc.addedBy,
        tenantId: doc.tenantId,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
      officeCount++;
      continue;
    }

    const { role: _role, notes, addedBy, ...rest } = doc;
    const person = {
      ...rest,
      inOutsourced: Boolean(doc.inTsc || doc.inOutsourced),
      inNewsletter: Boolean(doc.inNewsletter),
    };
    delete person._id;
    person._legacyContactId = doc._id;
    await personIdx.insertOne(person);
    personCount++;
  }

  console.log(`migrated ${personCount} → personindexes, ${officeCount} → officecontacts`);
  if (!embedded) await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
