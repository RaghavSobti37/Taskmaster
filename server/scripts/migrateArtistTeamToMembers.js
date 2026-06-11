/**
 * One-time migration: artist.team[] → ArtistMembership documents.
 * Does NOT run automatically — execute manually when ready:
 *   node server/scripts/migrateArtistTeamToMembers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const ArtistMembership = require('../models/ArtistMembership');
const { getDefaultPermissionsForRole } = require('../domains/artists/constants/artistMembershipRoles');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const artists = await Artist.find({}).select('team tenantId').setOptions({ bypassTenant: true }).lean();
  let created = 0;
  let skipped = 0;

  for (const artist of artists) {
    const team = artist.team || [];
    for (let i = 0; i < team.length; i += 1) {
      const userId = team[i];
      const existing = await ArtistMembership.findOne({ artistId: artist._id, userId })
        .setOptions({ bypassTenant: true });
      if (existing) {
        skipped += 1;
        continue;
      }

      const role = i === 0 ? 'artist-owner' : 'artist-assistant';
      await ArtistMembership.create({
        artistId: artist._id,
        userId,
        role,
        permissions: getDefaultPermissionsForRole(role),
        invitedAt: new Date(),
        acceptedAt: new Date(),
        status: 'accepted',
        tenantId: artist.tenantId,
      });
      created += 1;
    }
  }

  console.log(`Created ${created} ArtistMembership docs (${skipped} already existed)`);
  console.log('Migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
