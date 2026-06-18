const mongoose = require('mongoose');
const NavbarPreference = require('../models/NavbarPreference');
const {
  findOrCreateNavbarPreference,
  upsertNavbarPreference,
} = require('../utils/navbarPreferenceService');

describe('navbarPreferenceService', () => {
  it('findOrCreateNavbarPreference returns one doc under concurrent create', async () => {
    const userId = new mongoose.Types.ObjectId();

    const [a, b] = await Promise.all([
      findOrCreateNavbarPreference(userId),
      findOrCreateNavbarPreference(userId),
    ]);

    expect(a._id.toString()).toBe(b._id.toString());
    expect(a.groups?.length).toBeGreaterThan(0);

    const count = await NavbarPreference.countDocuments({ userId });
    expect(count).toBe(1);
  });

  it('upsertNavbarPreference survives duplicate-key race on insert', async () => {
    const userId = new mongoose.Types.ObjectId();
    const customGroups = [{ id: 'g1', title: 'G', order: 1, visible: true, pages: [] }];

    const [a, b] = await Promise.all([
      upsertNavbarPreference(userId, { groups: customGroups, updatedAt: new Date() }),
      upsertNavbarPreference(userId, { groups: customGroups, updatedAt: new Date() }),
    ]);

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(await NavbarPreference.countDocuments({ userId })).toBe(1);
  });
});
