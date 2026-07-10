const mongoose = require('mongoose');
const Project = require('../models/Project');
const ProjectGoal = require('../models/ProjectGoal');
const ProjectGoalSnapshot = require('../models/ProjectGoalSnapshot');
const ExlyBooking = require('../../../models/ExlyBooking');
const ExlyOffering = require('../../../models/ExlyOffering');
const Artist = require('../../../models/Artist');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const { findLeadsInDateRange } = require('../../crm/services/leadQueryService');
const { normalizeArtistKey } = require('../../../utils/artistEnquiryProjectResolver');
const {
  CRM_DIGEST_PLAN_OPTIONS,
  emptyCrmDigestSettings,
  getCrmDigestSegmentForProject,
  normalizePlanValues,
} = require('../../../../shared/crmDigestProjects.cjs');
const { getCurrentWeekRange } = require('../../../utils/attendanceDate');

const METRIC_KEYS = ['sales', 'totalReach', 'warmLeads', 'audienceExposure'];

function projectMatchRegex(projectName) {
  const key = normalizeArtistKey(projectName);
  if (!key) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

function textMatchesProject(text, pattern) {
  if (!text || !pattern) return false;
  return pattern.test(String(text));
}

function keywordListMatch(text, keywords = []) {
  if (!text || !keywords.length) return false;
  const hay = String(text).toLowerCase();
  return keywords.some((kw) => {
    const needle = String(kw || '').trim().toLowerCase();
    return needle && hay.includes(needle);
  });
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))];
}

function normalizeReferenceUrls(urls) {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((row) => ({
      _id: row._id,
      label: String(row.label || '').trim(),
      url: String(row.url || '').trim(),
    }))
    .filter((row) => row.label && row.url);
}

function resolveMetricValue(autoValue, override) {
  if (override?.enabled) return Number(override.value) || 0;
  return autoValue;
}

async function aggregateProjectMetrics(projectId, rangeStart, rangeEnd, goalDoc) {
  const project = await Project.findById(projectId).lean();
  if (!project) return null;

  const goal = goalDoc || await ProjectGoal.findOne({ projectId }).lean();
  const sourceLinks = goal?.sourceLinks || {};
  const linkedArtistIds = new Set(
    (sourceLinks.artistIds || []).map((id) => String(id))
  );
  const offeringIds = new Set(normalizeStringList(sourceLinks.offeringIds));
  const offeringKeywords = normalizeStringList(sourceLinks.offeringKeywords);
  const leadKeywords = normalizeStringList(sourceLinks.leadKeywords);

  const pattern = projectMatchRegex(project.name);
  const dateFilter = {};
  if (rangeStart) dateFilter.$gte = rangeStart;
  if (rangeEnd) dateFilter.$lte = rangeEnd;

  const bookings = await ExlyBooking.find(
    rangeStart || rangeEnd ? { bookedOn: dateFilter } : {}
  ).lean();

  let sales = 0;
  for (const b of bookings) {
    const idMatch = offeringIds.size > 0 && offeringIds.has(String(b.offeringId || ''));
    const nameMatch = textMatchesProject(b.offeringOwner, pattern)
      || textMatchesProject(b.offeringTitle, pattern);
    const keywordMatch = keywordListMatch(b.offeringTitle, offeringKeywords)
      || keywordListMatch(b.offeringOwner, offeringKeywords);
    if (idMatch || nameMatch || keywordMatch) {
      sales += Number(b.pricePaid) || 0;
    }
  }

  const leads = await findLeadsInDateRange(rangeStart, rangeEnd);

  let warmLeads = 0;
  for (const lead of leads) {
    const isWarm = String(lead.meaningfulConnect || '').toUpperCase() === 'YES'
      && !String(lead.leadStatus || '').toLowerCase().includes('convert');
    if (!isWarm) continue;
    const nameMatch = textMatchesProject(lead.exlyOfferingTitle, pattern)
      || (lead.tags || []).some((t) => textMatchesProject(t, pattern))
      || textMatchesProject(lead.source, pattern);
    const keywordMatch = keywordListMatch(lead.exlyOfferingTitle, leadKeywords)
      || keywordListMatch(lead.source, leadKeywords)
      || (lead.tags || []).some((t) => keywordListMatch(t, leadKeywords));
    if (nameMatch || keywordMatch) warmLeads += 1;
  }

  const artists = await Artist.find({}).lean();
  let totalReach = 0;
  let audienceExposure = 0;

  for (const artist of artists) {
    const linked = linkedArtistIds.has(String(artist._id));
    const nameMatch = textMatchesProject(artist.name, pattern);
    if (!linked && !nameMatch) continue;

    const metrics = await ArtistMetrics.findOne({ artistId: artist._id }).lean();
    const yt = metrics?.analytics?.youtube?.subscribers || 0;
    const ig = metrics?.analytics?.instagram?.followers || 0;
    const sp = metrics?.analytics?.spotify?.followers || 0;
    totalReach += yt + ig + sp;

    for (const ev of artist.events || []) {
      if (ev.status === 'cancelled') continue;
      const audience = parseInt(String(ev.audience || '0').replace(/\D/g, ''), 10) || 0;
      audienceExposure += audience;
    }
  }

  return {
    sales: Math.round(sales),
    totalReach,
    warmLeads,
    audienceExposure,
  };
}

async function getOrCreateGoal(projectId) {
  let goal = await ProjectGoal.findOne({ projectId });
  if (!goal) {
    goal = await ProjectGoal.create({
      projectId,
      targets: {
        sales: { target: 0 },
        totalReach: { target: 0 },
        warmLeads: { target: 0 },
        audienceExposure: { target: 0 },
      },
      sourceLinks: {
        artistIds: [],
        offeringIds: [],
        offeringKeywords: [],
        leadKeywords: [],
        referenceUrls: [],
      },
      metricOverrides: {
        sales: { enabled: false, value: 0 },
        totalReach: { enabled: false, value: 0 },
        warmLeads: { enabled: false, value: 0 },
        audienceExposure: { enabled: false, value: 0 },
      },
      crmDigest: emptyCrmDigestSettings(),
    });
  }
  return goal;
}

async function captureWeeklySnapshot(projectId, goalDoc) {
  const { weekStartKey, weekStart, weekEnd } = getCurrentWeekRange();
  const autoValues = await aggregateProjectMetrics(projectId, weekStart, weekEnd, goalDoc);
  const overrides = goalDoc?.metricOverrides || {};
  const values = {};
  for (const key of METRIC_KEYS) {
    values[key] = resolveMetricValue(autoValues[key], overrides[key]);
  }

  const prevKey = new Date(weekStart);
  prevKey.setDate(prevKey.getDate() - 7);
  const prevMonday = getCurrentWeekRange(prevKey.toISOString().slice(0, 10));
  const prevSnapshot = await ProjectGoalSnapshot.findOne({
    projectId,
    weekKey: prevMonday.weekStartKey,
  }).lean();

  const increments = {
    sales: values.sales - (prevSnapshot?.values?.sales || 0),
    totalReach: values.totalReach - (prevSnapshot?.values?.totalReach || 0),
    warmLeads: values.warmLeads - (prevSnapshot?.values?.warmLeads || 0),
    audienceExposure: values.audienceExposure - (prevSnapshot?.values?.audienceExposure || 0),
  };

  const snapshot = await ProjectGoalSnapshot.findOneAndUpdate(
    { projectId, weekKey: weekStartKey },
    { values, increments, capturedAt: new Date() },
    { upsert: true, returnDocument: 'after' }
  );

  return snapshot;
}

async function getGoalProgress(projectId) {
  const goal = await getOrCreateGoal(projectId);
  const goalObj = goal.toObject();
  const autoMetrics = await aggregateProjectMetrics(projectId, null, null, goalObj);
  await captureWeeklySnapshot(projectId, goalObj);

  const { weekStartKey } = getCurrentWeekRange();
  const currentSnapshot = await ProjectGoalSnapshot.findOne({ projectId, weekKey: weekStartKey }).lean();
  const history = await ProjectGoalSnapshot.find({ projectId })
    .sort({ weekKey: -1 })
    .limit(12)
    .lean();

  const targets = goalObj.targets || {};
  const overrides = goalObj.metricOverrides || {};
  const progress = {};
  for (const key of METRIC_KEYS) {
    const auto = autoMetrics[key] ?? 0;
    progress[key] = {
      current: resolveMetricValue(auto, overrides[key]),
      auto,
      overridden: !!overrides[key]?.enabled,
      target: targets[key]?.target || 0,
    };
  }

  const linkedArtists = (goalObj.sourceLinks?.artistIds?.length)
    ? await Artist.find({ _id: { $in: goalObj.sourceLinks.artistIds } }).select('name').lean()
    : [];

  const offeringIdsList = normalizeStringList(goalObj.sourceLinks?.offeringIds);
  const linkedOfferings = offeringIdsList.length
    ? await ExlyOffering.find({ offeringId: { $in: offeringIdsList } }).select('offeringId title').lean()
    : [];

  const exlyOfferings = await ExlyOffering.find({})
    .select('offeringId title eventDate status')
    .sort({ title: 1 })
    .lean();

  return {
    goal: goalObj,
    progress,
    linkedArtists,
    linkedOfferings,
    exlyOfferings,
    weekly: currentSnapshot,
    history,
  };
}

async function updateGoal(projectId, payload, userId) {
  const goal = await getOrCreateGoal(projectId);
  if (payload.endDate !== undefined) goal.endDate = payload.endDate ? new Date(payload.endDate) : null;
  if (payload.startDate !== undefined) goal.startDate = payload.startDate ? new Date(payload.startDate) : null;

  if (payload.targets) {
    for (const key of METRIC_KEYS) {
      if (payload.targets[key]?.target != null) {
        goal.targets[key] = { target: Number(payload.targets[key].target) || 0 };
      }
    }
  }

  if (payload.sourceLinks) {
    if (!goal.sourceLinks) goal.sourceLinks = {};
    if (payload.sourceLinks.artistIds) {
      goal.sourceLinks.artistIds = payload.sourceLinks.artistIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }
    if (payload.sourceLinks.offeringIds) {
      goal.sourceLinks.offeringIds = normalizeStringList(payload.sourceLinks.offeringIds);
    }
    if (payload.sourceLinks.offeringKeywords) {
      goal.sourceLinks.offeringKeywords = normalizeStringList(payload.sourceLinks.offeringKeywords);
    }
    if (payload.sourceLinks.leadKeywords) {
      goal.sourceLinks.leadKeywords = normalizeStringList(payload.sourceLinks.leadKeywords);
    }
    if (payload.sourceLinks.referenceUrls) {
      goal.sourceLinks.referenceUrls = normalizeReferenceUrls(payload.sourceLinks.referenceUrls);
    }
  }

  if (payload.metricOverrides) {
    if (!goal.metricOverrides) goal.metricOverrides = {};
    for (const key of METRIC_KEYS) {
      if (!payload.metricOverrides[key]) continue;
      goal.metricOverrides[key] = {
        enabled: !!payload.metricOverrides[key].enabled,
        value: Number(payload.metricOverrides[key].value) || 0,
      };
    }
  }

  goal.updatedBy = userId;
  await goal.save();
  return getGoalProgress(projectId);
}

async function updateCrmDigestSettings(projectId, payload, userId, segment) {
  const goal = await getOrCreateGoal(projectId);
  const monthlyTargetLakhs = Number(payload?.monthlyTargetLakhs);
  goal.crmDigest = {
    monthlyTargetLakhs: Number.isFinite(monthlyTargetLakhs) && monthlyTargetLakhs >= 0
      ? monthlyTargetLakhs
      : 0,
    planValues: normalizePlanValues(payload?.planValues),
    crmType: segment?.crmType || 'sales',
  };
  goal.updatedBy = userId;
  await goal.save();
  return getGoalProgress(projectId);
}

async function getCrmDigestSettingsForProject(projectId) {
  const project = await Project.findById(projectId).select('name workspace').lean();
  const segment = getCrmDigestSegmentForProject(project);
  if (!segment) return null;
  const goal = await getOrCreateGoal(projectId);
  return {
    segment,
    crmDigest: goal.crmDigest || emptyCrmDigestSettings(segment.crmType),
    canConfigure: true,
  };
}

module.exports = {
  aggregateProjectMetrics,
  getGoalProgress,
  updateGoal,
  updateCrmDigestSettings,
  getCrmDigestSettingsForProject,
  captureWeeklySnapshot,
  METRIC_KEYS,
};
