const NavbarPreference = require('../models/NavbarPreference');
const { DEFAULT_NAVBAR_GROUPS } = NavbarPreference;

function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

/** Find existing doc or create defaults — safe under concurrent first-time requests. */
async function findOrCreateNavbarPreference(userId) {
  let doc = await NavbarPreference.findOne({ userId });
  if (doc) return doc;

  try {
    return await NavbarPreference.create({
      userId,
      groups: DEFAULT_NAVBAR_GROUPS,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    doc = await NavbarPreference.findOne({ userId });
    if (!doc) throw err;
    return doc;
  }
}

/** Upsert with duplicate-key retry when two requests race on first insert. */
async function upsertNavbarPreference(userId, update, options = {}) {
  try {
    return await NavbarPreference.findOneAndUpdate({ userId }, update, {
      new: true,
      upsert: true,
      ...options,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    await findOrCreateNavbarPreference(userId);
    return NavbarPreference.findOneAndUpdate({ userId }, update, { new: true });
  }
}

module.exports = {
  findOrCreateNavbarPreference,
  upsertNavbarPreference,
  isDuplicateKeyError,
};
