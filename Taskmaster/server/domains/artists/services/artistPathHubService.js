const mongoose = require('mongoose');
const PersonHubView = require('../../../models/PersonHubView');
const ArtistPathResponse = require('../../../models/ArtistPathResponse');

const BYPASS = { bypassTenant: true };

class ArtistPathHubService {
  async countPeople(query) {
    return PersonHubView.countDocuments(query).setOptions(BYPASS);
  }

  async listPeople(query, { skip = 0, limit = 24, sort = { lastActivityAt: -1 } } = {}) {
    return PersonHubView.find(query)
      .setOptions(BYPASS)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async findHubByPersonId(personId) {
    const pid = mongoose.Types.ObjectId.isValid(personId)
      ? new mongoose.Types.ObjectId(personId)
      : personId;
    return PersonHubView.findOne({ personId: pid }).setOptions(BYPASS).lean();
  }

  async listResponsesForPerson(personId, sort = { submittedAt: -1 }) {
    const pid = mongoose.Types.ObjectId.isValid(personId)
      ? new mongoose.Types.ObjectId(personId)
      : personId;
    return ArtistPathResponse.find({ personId: pid })
      .setOptions(BYPASS)
      .sort(sort)
      .lean();
  }
}

module.exports = new ArtistPathHubService();
