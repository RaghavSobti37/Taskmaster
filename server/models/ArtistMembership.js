const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const {
  ARTIST_MEMBERSHIP_ROLES,
  ARTIST_MEMBERSHIP_STATUSES,
  getDefaultPermissionsForRole,
} = require('../domains/artists/constants/artistMembershipRoles');

const permissionFields = {
  analytics: { type: Boolean, default: false },
  finance: { type: Boolean, default: false },
  contracts: { type: Boolean, default: false },
  content: { type: Boolean, default: false },
  calendar: { type: Boolean, default: false },
  socials: { type: Boolean, default: false },
  booking: { type: Boolean, default: false },
  profile: { type: Boolean, default: false },
  team: { type: Boolean, default: false },
};

const ArtistMembershipSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  inviteEmail: { type: String, trim: true, lowercase: true },
  inviteToken: { type: String, index: true },
  role: { type: String, enum: ARTIST_MEMBERSHIP_ROLES, required: true },
  permissions: { type: permissionFields, default: undefined },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invitedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  status: { type: String, enum: ARTIST_MEMBERSHIP_STATUSES, default: 'pending' },
}, { timestamps: true });

ArtistMembershipSchema.index({ artistId: 1, userId: 1 }, { unique: true, sparse: true });
ArtistMembershipSchema.index(
  { artistId: 1, inviteEmail: 1 },
  { unique: true, sparse: true, partialFilterExpression: { inviteEmail: { $type: 'string' } } },
);

ArtistMembershipSchema.pre('validate', function setDefaultPermissions() {
  if (!this.permissions || Object.values(this.permissions.toObject?.() || this.permissions).every((v) => v === false)) {
    this.permissions = getDefaultPermissionsForRole(this.role);
  }
  if (this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
});

ArtistMembershipSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistMembership', ArtistMembershipSchema);
