const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Department = require('../models/Department');
const { CRM_TYPES } = require('../../shared/artistCrmTaxonomy');
const { resolvePrimaryCallAssigneeId } = require('./primaryCallAssignee');
const { resolveSatyamSalesRepId } = require('./bookedCallRepAssignment');

const SALES_SLUG = 'sales';
const ARTIST_SLUG = 'artist-management';

const getSalesRepUsers = async (session = null) => {
  const salesDept = await Department.findOne({ slug: SALES_SLUG }).session(session);
  if (!salesDept) return [];
  return User.find({ departmentId: salesDept._id }).session(session);
};

const getArtistRepUsers = async (session = null) => {
  const artistDept = await Department.findOne({ slug: ARTIST_SLUG }).session(session);
  if (!artistDept) return [];
  return User.find({ departmentId: artistDept._id }).session(session);
};

const assignLeadToRep = async (session = null) => {
  const satyamId = await resolveSatyamSalesRepId();
  if (satyamId) return satyamId;

  const reps = await getSalesRepUsers(session);
  if (reps.length === 0) return null;

  const leadCounts = await Promise.all(reps.map(async (rep) => {
    const count = await Lead.countDocuments({
      assignedRepId: rep._id,
      crmType: CRM_TYPES.SALES,
      leadStatus: { $ne: 'Converted' },
    }).session(session);
    return { repId: rep._id, count };
  }));

  leadCounts.sort((a, b) => a.count - b.count);
  return leadCounts[0].repId;
};

const assignLeadToArtistRep = async (session = null) => {
  const primaryId = await resolvePrimaryCallAssigneeId();
  if (primaryId) return primaryId;

  const reps = await getArtistRepUsers(session);
  if (reps.length === 0) return null;

  const leadCounts = await Promise.all(reps.map(async (rep) => {
    const count = await Lead.countDocuments({
      assignedRepId: rep._id,
      crmType: CRM_TYPES.ARTIST,
      leadStatus: { $ne: 'Converted' },
    }).session(session);
    return { repId: rep._id, count };
  }));

  leadCounts.sort((a, b) => a.count - b.count);
  return leadCounts[0].repId;
};

module.exports = {
  getSalesRepUsers,
  getArtistRepUsers,
  assignLeadToRep,
  assignLeadToArtistRep,
};
