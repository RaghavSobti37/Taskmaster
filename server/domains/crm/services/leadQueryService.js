const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { escapeRegExp } = require('../../person/identity');
const { applyCrmScopeToQuery } = require('../../../utils/crmScope');
const {
  isWarmPipelineRequest,
  leadStatusFilterValue,
  warmPipelineQuery,
} = require('../../../utils/crmPipelineFilters');
const {
  FOLLOWUP_DATE_FIELD,
  followupDateExistsStage,
  buildFollowupTabMatch,
  buildFollowupStatsGroupStage,
} = require('../../../utils/followupDateQuery');
const logger = require('../../../utils/logger');

const LEAD_LIST_PROJECTION = {
  assignedRepId: 1,
  name: 1, email: 1, phone: 1, city: 1, source: 1,
  webinarDates: 1, attended: 1, attendanceDurationMin: 1, qnaAnswered: 1,
  artistType: 1, primaryRole: 1, metadata: 1, tags: 1, emailStatus: 1,
  crmType: 1, artistProject: 1, contactCategory: 1,
  meaningfulConnect: 1, leadQuality: 1, callStatus: 1, leadStatus: 1,
  remarks: 1, notes: 1, setReminder: 1, planOption: 1, nextFollowupDate: 1, nextFollowupTime: 1,
  createdAt: 1, updatedAt: 1,
  exlyOfferings: 1, exlyOfferingTitle: 1, exlyOfferingId: 1,
  'assignedRep.name': 1, 'assignedRep.email': 1, 'assignedRep.avatar': 1,
};

function buildLeadListQuery(user, queryParams) {
  const query = {};
  applyCrmScopeToQuery(query, user, queryParams);

  if (queryParams.search) {
    const escaped = escapeRegExp(queryParams.search);
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { city: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (queryParams.leadQuality && queryParams.leadQuality !== 'all') query.leadQuality = queryParams.leadQuality;
  if (queryParams.callStatus && queryParams.callStatus !== 'all') query.callStatus = queryParams.callStatus;
  if (queryParams.source && queryParams.source !== 'all') query.source = queryParams.source;

  if (isWarmPipelineRequest(queryParams)) {
    Object.assign(query, warmPipelineQuery());
  } else if (queryParams.leadStatus && queryParams.leadStatus !== 'all') {
    if (queryParams.leadStatus === 'Fresh') {
      query.$or = [
        { leadStatus: null },
        { leadStatus: '' },
        { leadStatus: 'New' },
        { leadStatus: 'Fresh' },
        { leadStatus: 'DNP' },
        { leadStatus: { $exists: false } },
      ];
    } else if (queryParams.leadStatus === 'Contacted' || queryParams.leadStatus === 'In Progress') {
      query.leadStatus = { $in: ['Connected', 'Warm', 'Cold', 'Converted', 'Contacted', 'In Progress', 'Busy', 'Already Purchased'] };
    } else {
      query.leadStatus = leadStatusFilterValue(queryParams.leadStatus);
    }
  }

  if (!isWarmPipelineRequest(queryParams) && queryParams.meaningfulConnect && queryParams.meaningfulConnect !== 'all') {
    query.meaningfulConnect = queryParams.meaningfulConnect;
  }

  if (queryParams.assignedRepId && queryParams.assignedRepId !== 'all') {
    if (queryParams.assignedRepId === 'unassigned' || queryParams.assignedRepId === 'null') {
      query.assignedRepId = null;
    } else if (mongoose.Types.ObjectId.isValid(queryParams.assignedRepId)) {
      query.assignedRepId = new mongoose.Types.ObjectId(queryParams.assignedRepId);
    } else {
      query.assignedRepId = queryParams.assignedRepId;
    }
  }
  if (queryParams.webinarDates && queryParams.webinarDates !== 'all') query.webinarDates = queryParams.webinarDates;
  if (queryParams.artistType && queryParams.artistType !== 'all') query.artistType = queryParams.artistType;
  if (queryParams.primaryRole && queryParams.primaryRole !== 'all') query.primaryRole = queryParams.primaryRole;
  if (queryParams.emailStatus && queryParams.emailStatus !== 'all') query.emailStatus = queryParams.emailStatus;
  if (queryParams.tag && queryParams.tag !== 'all') query.tags = queryParams.tag;
  if (queryParams.contactCategory && queryParams.contactCategory !== 'all') {
    query.contactCategory = queryParams.contactCategory;
  }
  if (queryParams.artistProject && queryParams.artistProject !== 'all') {
    if (queryParams.artistProject === 'shared') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { artistProject: null },
          { artistProject: '' },
          { artistProject: { $exists: false } },
        ],
      });
    } else {
      query.artistProject = queryParams.artistProject;
    }
  }
  if (queryParams.excludeContactCategory) {
    query.contactCategory = { $ne: queryParams.excludeContactCategory };
  }
  if (queryParams.hasFollowup === 'true') query.nextFollowupDate = { $exists: true, $ne: '' };
  if (queryParams.hasEmail === 'true') query.email = { $type: 'string', $ne: '' };

  if (queryParams.hasExly === 'true') {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { 'exlyOfferings.0': { $exists: true } },
        { exlyOfferingId: { $type: 'string', $ne: '' } },
        { exlyOfferingTitle: { $type: 'string', $ne: '' } },
      ],
    });
  }

  if (queryParams.exlyOfferingIds) {
    const ids = String(queryParams.exlyOfferingIds)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { exlyOfferingId: { $in: ids } },
          { 'exlyOfferings.offeringId': { $in: ids } },
        ],
      });
    }
  }

  return query;
}

function buildLeadLookupPipeline(query, queryParams, { extraProjection = {} } = {}) {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;
  const sortField = queryParams.sort || 'createdAt';
  const sortOrder = queryParams.order === 'asc' ? 1 : -1;

  const hasFollowupQuery = queryParams.hasFollowup === 'true';
  const followupTab = ['today', 'overdue', 'upcoming'].includes(queryParams.followupTab)
    ? queryParams.followupTab
    : null;
  const followupStages = hasFollowupQuery
    ? [{ $addFields: FOLLOWUP_DATE_FIELD }, followupDateExistsStage]
    : [];
  const tabMatchStage = hasFollowupQuery && followupTab ? buildFollowupTabMatch(followupTab) : null;

  const pipeline = [
    { $match: query },
    ...followupStages,
    ...(tabMatchStage ? [tabMatchStage] : []),
    { $sort: { [sortField]: sortOrder, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedRepId',
        foreignField: '_id',
        as: 'assignedRep',
      },
    },
    {
      $unwind: {
        path: '$assignedRep',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: { ...LEAD_LIST_PROJECTION, ...extraProjection },
    },
  ];

  return {
    pipeline,
    page,
    limit,
    skip,
    hasFollowupQuery,
    followupStages,
    tabMatchStage,
  };
}

async function fetchLeadsPaginated(user, queryParams) {
  const query = buildLeadListQuery(user, queryParams);
  const {
    pipeline,
    page,
    limit,
    hasFollowupQuery,
    followupStages,
    tabMatchStage,
  } = buildLeadLookupPipeline(query, queryParams);

  let total;
  let tabStats = null;

  if (hasFollowupQuery) {
    const [statsResult, countResult] = await Promise.all([
      Lead.aggregate([
        { $match: query },
        ...followupStages,
        buildFollowupStatsGroupStage(),
      ]),
      Lead.aggregate([
        { $match: query },
        ...followupStages,
        ...(tabMatchStage ? [tabMatchStage] : []),
        { $count: 'total' },
      ]),
    ]);
    tabStats = statsResult[0] || { today: 0, overdue: 0, upcoming: 0 };
    total = countResult[0]?.total || 0;
  } else {
    total = await Lead.countDocuments(query);
  }

  const leads = await Lead.aggregate(pipeline);
  return {
    leads,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    ...(tabStats ? { tabStats } : {}),
  };
}

async function fetchLeadById(user, leadId, queryParams = {}) {
  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    return { error: 'Invalid lead id', status: 400 };
  }

  const query = { _id: new mongoose.Types.ObjectId(leadId) };
  applyCrmScopeToQuery(query, user, queryParams);

  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedRepId',
        foreignField: '_id',
        as: 'assignedRep',
      },
    },
    {
      $unwind: {
        path: '$assignedRep',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        ...LEAD_LIST_PROJECTION,
        lockedBy: 1,
        lockedAt: 1,
      },
    },
  ];

  const [lead] = await Lead.aggregate(pipeline);
  if (!lead) return { error: 'Lead not found', status: 404 };
  return { lead };
}

async function streamLeadExport(res, { format: exportFormat }) {
  if (exportFormat === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_export.json');
    res.write('[');
    let isFirst = true;
    const cursor = Lead.find({}).populate('assignedRepId', 'name').lean().cursor();

    cursor.on('data', (doc) => {
      if (!isFirst) res.write(',');
      res.write(JSON.stringify(doc));
      isFirst = false;
    });
    cursor.on('end', () => { res.write(']'); res.end(); });
    cursor.on('error', (err) => {
      logger.error('leadQueryService', 'Export JSON stream error', { error: err.message });
      if (!res.headersSent) res.status(500).end();
    });
    return;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');

  const fields = ['name', 'email', 'phone', 'city', 'leadStatus', 'callStatus', 'leadQuality', 'remarks', 'assignedRep', 'createdAt'];
  res.write(`${fields.join(',')}\n`);

  const cursor = Lead.find({}).populate('assignedRepId', 'name').lean().cursor();

  cursor.on('data', (l) => {
    const row = [
      `"${(l.name || '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').toLowerCase().replace(/"/g, '""')}"`,
      `"${(l.leadStatus || '').replace(/"/g, '""')}"`,
      `"${(l.callStatus || '').replace(/"/g, '""')}"`,
      `"${(l.leadQuality || '').replace(/"/g, '""')}"`,
      `"${(l.remarks || '').replace(/[\r\n]+/g, ' • ').replace(/"/g, '""')}"`,
      `"${(l.assignedRepId?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${l.createdAt ? l.createdAt.toISOString() : ''}"`,
    ];
    res.write(`${row.join(',')}\n`);
  });

  cursor.on('end', () => res.end());
  cursor.on('error', (err) => {
    logger.error('leadQueryService', 'Export CSV stream error', { error: err.message });
    if (!res.headersSent) res.status(500).end();
  });
}

async function findLeadsInDateRange(rangeStart, rangeEnd) {
  const dateFilter = {};
  if (rangeStart) dateFilter.$gte = rangeStart;
  if (rangeEnd) dateFilter.$lte = rangeEnd;
  const query = (rangeStart || rangeEnd) ? { createdAt: dateFilter } : {};
  return Lead.find(query).lean();
}

module.exports = {
  buildLeadListQuery,
  fetchLeadsPaginated,
  fetchLeadById,
  streamLeadExport,
  findLeadsInDateRange,
};
