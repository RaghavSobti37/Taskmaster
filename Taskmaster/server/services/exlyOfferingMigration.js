const ExlyOffering = require('../models/ExlyOffering');
const ExlyBooking = require('../models/ExlyBooking');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { parseOfferingTitle, shouldIgnoreOffering } = require('../utils/exlyUtils');

const IGNORED_TITLE_PATTERNS = [/testing BR community/i, /Program Name/i, /testing/i, /demo community/i, /demo day- results/i];
const IGNORED_OFFERING_IDS = ['demo-community', 'demo-day--results'];

let migrationRunning = false;
let migrationDone = false;

const purgeIgnoredOfferings = async () => {
  await ExlyOffering.deleteMany({
    $or: [
      { title: { $in: IGNORED_TITLE_PATTERNS } },
      { offeringId: { $in: IGNORED_OFFERING_IDS } },
    ],
  });
};

const migrateOfferingTitles = async () => {
  const offerings = await ExlyOffering.find({
    $or: [
      { title: { $regex: '\\|' } },
      { title: { $in: IGNORED_TITLE_PATTERNS } },
      { offeringId: { $in: IGNORED_OFFERING_IDS } },
    ],
  }).select('_id title offeringId eventDate eventTime');

  for (const off of offerings) {
    if (shouldIgnoreOffering(off.title, off.offeringId)) {
      await ExlyOffering.deleteOne({ _id: off._id });
      continue;
    }
    if (off.title.includes('|')) {
      const { cleanTitle, dateStr, timeStr } = parseOfferingTitle(off.title);
      off.title = cleanTitle;
      off.eventDate = dateStr;
      off.eventTime = timeStr;
      await off.save();
    }
  }
};

const migrateBookingTitles = async () => {
  const bookings = await ExlyBooking.find({
    $or: [
      { offeringTitle: { $regex: '\\|' } },
      { offeringTitle: { $in: IGNORED_TITLE_PATTERNS } },
      { offeringId: { $in: IGNORED_OFFERING_IDS } },
    ],
  }).select('_id offeringTitle offeringId');

  for (const b of bookings) {
    if (shouldIgnoreOffering(b.offeringTitle, b.offeringId)) {
      await ExlyBooking.deleteOne({ _id: b._id });
      continue;
    }
    if (b.offeringTitle && b.offeringTitle.includes('|')) {
      const { cleanTitle } = parseOfferingTitle(b.offeringTitle);
      b.offeringTitle = cleanTitle;
      await b.save();
    }
  }
};

const migrateLeadOfferingTitles = async () => {
  const leads = await Lead.find({ exlyOfferingTitle: { $regex: '\\|' } }).select('_id exlyOfferingTitle source');

  for (const l of leads) {
    const { cleanTitle } = parseOfferingTitle(l.exlyOfferingTitle);
    l.exlyOfferingTitle = cleanTitle;
    l.source = cleanTitle;
    await l.save();
  }
};

const runExlyOfferingMigration = async () => {
  if (migrationRunning) return { skipped: true, reason: 'already_running' };
  migrationRunning = true;
  try {
    await purgeIgnoredOfferings();
    await migrateOfferingTitles();
    await migrateBookingTitles();
    await migrateLeadOfferingTitles();
    migrationDone = true;
    logger.info('Exly', 'Offering migration completed');
    return { success: true };
  } catch (err) {
    logger.error('Exly', 'Offering migration failed', { error: err.message });
    throw err;
  } finally {
    migrationRunning = false;
  }
};

const needsExlyOfferingMigration = async () => {
  if (migrationDone) return false;
  const [offeringPipes, bookingPipes, leadPipes] = await Promise.all([
    ExlyOffering.countDocuments({ title: { $regex: '\\|' } }).limit(1),
    ExlyBooking.countDocuments({ offeringTitle: { $regex: '\\|' } }).limit(1),
    Lead.countDocuments({ exlyOfferingTitle: { $regex: '\\|' } }).limit(1),
  ]);
  return offeringPipes > 0 || bookingPipes > 0 || leadPipes > 0;
};

const scheduleExlyOfferingMigrationIfNeeded = () => {
  if (migrationRunning || migrationDone) return;
  setImmediate(async () => {
    try {
      const needed = await needsExlyOfferingMigration();
      if (!needed) {
        migrationDone = true;
        return;
      }
      await runExlyOfferingMigration();
    } catch (err) {
      logger.warn('Exly', 'Background offering migration failed', { error: err.message });
    }
  });
};

module.exports = {
  runExlyOfferingMigration,
  scheduleExlyOfferingMigrationIfNeeded,
  needsExlyOfferingMigration,
  IGNORED_TITLE_PATTERNS,
  IGNORED_OFFERING_IDS,
};
