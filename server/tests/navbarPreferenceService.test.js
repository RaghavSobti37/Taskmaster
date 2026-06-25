const mongoose = require('mongoose');
const NavbarPreference = require('../models/NavbarPreference');
const {
  findOrCreateNavbarPreference,
  upsertNavbarPreference,
} = require('../utils/navbarPreferenceService');

describe('navbarPreferenceService', () => {
  it('findOrCreateNavbarPreference returns one doc under concurrent create', async () => {
    const userId = new mongoose.Types.ObjectId();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => findOrCreateNavbarPreference(userId)),
    );

    const firstId = results[0]._id.toString();
    results.forEach((doc) => {
      expect(doc._id.toString()).toBe(firstId);
      expect(doc.groups?.length).toBeGreaterThan(0);
    });

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

  it('findOrCreateNavbarPreference finds doc when tenant filter would miss it', async () => {
    const userId = new mongoose.Types.ObjectId();
    const otherTenantId = new mongoose.Types.ObjectId();

    await NavbarPreference.collection.insertOne({
      userId,
      tenantId: otherTenantId,
      groups: [{ id: 'legacy', title: 'Legacy', order: 1, visible: true, pages: [] }],
      updatedAt: new Date(),
    });

    const doc = await findOrCreateNavbarPreference(userId);

    expect(doc.userId.toString()).toBe(userId.toString());
    expect(doc.groups[0].id).toBe('legacy');
    expect(await NavbarPreference.countDocuments({ userId })).toBe(1);
  });
});
