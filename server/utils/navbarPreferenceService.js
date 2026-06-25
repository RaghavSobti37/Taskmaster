const NavbarPreference = require('../models/NavbarPreference');
const { DEFAULT_NAVBAR_GROUPS } = NavbarPreference;

// userId is globally unique; tenant-scoped queries miss legacy/mismatched docs and cause E11000 on insert.
const BYPASS = { bypassTenant: true };

function isDuplicateKeyError(err) {
  return err?.code === 11000 || String(err?.message || '').includes('E11000');
}

function findNavbarByUserId(userId) {
  return NavbarPreference.findOne({ userId }).setOptions(BYPASS);
}

/** Find existing doc or create defaults — atomic upsert safe under concurrent first-time requests. */
async function findOrCreateNavbarPreference(userId) {
  try {
    const doc = await NavbarPreference.findOneAndUpdate(
      { userId },
      { $setOnInsert: { groups: DEFAULT_NAVBAR_GROUPS, updatedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).setOptions(BYPASS);
    if (doc) return doc;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }

  const doc = await findNavbarByUserId(userId);
  if (!doc) {
    throw new Error('Failed to load navbar preferences after duplicate-key race');
  }
  return doc;
}

/** Upsert with duplicate-key retry when two requests race on first insert. */
async function upsertNavbarPreference(userId, update, options = {}) {
  try {
    return await NavbarPreference.findOneAndUpdate({ userId }, update, {
      new: true,
      upsert: true,
      ...options,
    }).setOptions(BYPASS);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    await findOrCreateNavbarPreference(userId);
    return NavbarPreference.findOneAndUpdate({ userId }, update, { new: true }).setOptions(BYPASS);
  }
}

module.exports = {
  findOrCreateNavbarPreference,
  upsertNavbarPreference,
  isDuplicateKeyError,
};
