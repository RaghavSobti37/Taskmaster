const ArtistMembership = require('../../../models/ArtistMembership');
const {
  getArtistMembers,
  getArtistMembershipDoc,
  normalizeMembershipUpdate,
  inviteArtistMember,
  acceptArtistMembership,
  countAcceptedOwners,
  ensureUserOnArtistTeam,
  removeUserFromArtistTeam,
  serializeMembership,
} = require('../services/artistMembershipService');

/** GET /api/artists/:id/members */
exports.listMembers = async (req, res) => {
  try {
    const members = await getArtistMembers(req.params.id);
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/artists/:id/members/invite — body: { email, role } */
exports.inviteMember = async (req, res) => {
  try {
    const { email, role = 'artist-assistant' } = req.body;
    const membership = await inviteArtistMember({
      artistId: req.params.id,
      email,
      role,
      invitedBy: req.user,
    });
    res.status(201).json(membership);
  } catch (err) {
    const status = err.statusCode || (err.message?.includes('Invalid') ? 400 : 500);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'User is already a member' });
    }
    res.status(status).json({ message: err.message });
  }
};

/** POST /api/artists/:id/members/accept — body: { token } or { membershipId } */
exports.acceptMembership = async (req, res) => {
  try {
    const { token, membershipId } = req.body;
    const result = await acceptArtistMembership({ token, membershipId, user: req.user });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/** PATCH /api/artists/:id/members/:membershipId */
exports.updateMember = async (req, res) => {
  try {
    const update = normalizeMembershipUpdate(req.body);
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const member = await ArtistMembership.findOneAndUpdate(
      { _id: req.params.membershipId, artistId: req.params.id, status: { $ne: 'revoked' } },
      { $set: update },
      { returnDocument: 'after' },
    ).populate('userId', 'name email profileImage');

    if (!member) return res.status(404).json({ message: 'Membership not found' });

    if (member.status === 'accepted' && member.userId) {
      await ensureUserOnArtistTeam(req.params.id, member.userId);
    }

    res.json(serializeMembership(member.toObject()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/** DELETE /api/artists/:id/members/:membershipId */
exports.removeMember = async (req, res) => {
  try {
    const member = await ArtistMembership.findOne({
      _id: req.params.membershipId,
      artistId: req.params.id,
      status: { $ne: 'revoked' },
    });

    if (!member) return res.status(404).json({ message: 'Membership not found' });

    if (member.role === 'artist-owner' && member.status === 'accepted') {
      const ownerCount = await countAcceptedOwners(req.params.id);
      if (ownerCount <= 1) {
        return res.status(403).json({ message: 'Cannot remove the sole artist owner' });
      }
    }

    member.status = 'revoked';
    await member.save();

    if (member.userId) {
      await removeUserFromArtistTeam(req.params.id, member.userId);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/artists/:id/membership/me */
exports.getMyMembership = async (req, res) => {
  try {
    const member = await getArtistMembershipDoc(req.user._id, req.params.id);
    if (member?.status === 'accepted') {
      return res.json(serializeMembership(member));
    }

    const members = await getArtistMembers(req.params.id);
    const legacy = members.find(
      (m) => m.legacy && String(m.userId?._id || m.userId) === String(req.user._id),
    );

    if (legacy) {
      return res.json(legacy);
    }

    res.json(null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
