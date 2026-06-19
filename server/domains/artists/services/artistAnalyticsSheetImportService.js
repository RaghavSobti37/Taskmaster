const fs = require('fs');
const Artist = require('../../../models/Artist');
const ArtistMetrics = require('../../../models/ArtistMetrics');
const ArtistAudienceSnapshot = require('../../../models/ArtistAudienceSnapshot');
const { detectAnalyticsSheetTemplate } = require('../../../../shared/artistAnalyticsSheetMappings');
const { resolveProjectNameFromArtist } = require('../../../utils/artistEnquiryProjectResolver');

const BYPASS = { bypassTenant: true };

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseMetricNumber(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/,/g, '').replace(/%/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseGrowthMetric(raw) {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();
  const hasPercent = str.includes('%');
  const n = parseMetricNumber(str);
  if (n == null) return null;
  if (hasPercent) return n;
  return Number((n * 100).toFixed(4));
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseAnalyticsCsvText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metrics = {};
  const interests = [];
  let periodLabel = null;
  let inInterests = false;

  for (const line of lines) {
    if (line.startsWith('Master,')) continue;

    const parts = parseCsvLine(line);
    if (parts.length < 2) continue;

    const [key, value] = parts;
    if (key === 'Metric' && value) {
      periodLabel = value;
      continue;
    }
    if (key === 'Top Audience Interests') {
      inInterests = true;
      continue;
    }
    if (inInterests) {
      if (key === 'Interest' && value === '%') continue;
      const pct = parseMetricNumber(value);
      if (key && pct != null) interests.push({ name: key, pct });
      continue;
    }
    metrics[key] = value;
  }

  return { metrics, interests, periodLabel };
}

function parsePeriodDate(periodLabel) {
  if (!periodLabel) return new Date();
  const parsed = new Date(`${periodLabel} 1`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function buildDemographics(metrics, interests) {
  const cities = {};
  for (const [key, raw] of Object.entries(metrics)) {
    const match = key.match(/^(.+) Audience$/);
    if (!match || match[1] === 'India') continue;
    const pct = parseMetricNumber(raw);
    if (pct != null) cities[match[1]] = pct;
  }

  return {
    gender: {
      female: parseMetricNumber(metrics['Female Audience %']),
      male: parseMetricNumber(metrics['Male Audience %']),
    },
    age: {
      '18-24': parseMetricNumber(metrics['Age 18-24']),
      '25-34': parseMetricNumber(metrics['Age 25-34']),
      '35-44': parseMetricNumber(metrics['Age 35-44']),
    },
    geo: {
      india: parseMetricNumber(metrics['India Audience']),
      cities,
    },
    interests,
    source: 'mastersheet',
  };
}

function buildInstagramAnalytics(metrics, interests) {
  const followers = parseMetricNumber(metrics.Followers);
  const engagementRate = parseMetricNumber(metrics['Engagement Rate']);

  return {
    followers: followers ?? 0,
    engagementRate: engagementRate ?? 0,
    followerVelocity: parseGrowthMetric(metrics['Follower Growth']) ?? 0,
    avgLikes: parseMetricNumber(metrics['Avg Likes']) ?? 0,
    likesGrowth: parseGrowthMetric(metrics['Likes Growth']) ?? 0,
    reelsPerformance: {
      views: parseMetricNumber(metrics['Avg Reel Plays']) ?? 0,
      likes: parseMetricNumber(metrics['Avg Reel Likes']) ?? 0,
      comments: parseMetricNumber(metrics['Avg Reel Comments']) ?? 0,
      shares: parseMetricNumber(metrics['Avg Reel Shares']) ?? 0,
    },
    stories: {
      reach: parseMetricNumber(metrics['Avg Story Reach']) ?? 0,
      impressions: parseMetricNumber(metrics['Avg Story Impressions']) ?? 0,
    },
    demographics: buildDemographics(metrics, interests),
    mastersheetImportedAt: new Date(),
  };
}

async function findArtistByNames(names = []) {
  const candidates = [...new Set(names.filter(Boolean))];
  for (const name of candidates) {
    const exact = await Artist.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
    }).setOptions(BYPASS).lean();
    if (exact) return exact;
  }

  for (const name of candidates) {
    const projectName = resolveProjectNameFromArtist(name);
    if (!projectName) continue;
    const byProject = await Artist.findOne({
      name: new RegExp(`^${escapeRegex(projectName)}$`, 'i'),
    }).setOptions(BYPASS).lean();
    if (byProject) return byProject;
  }

  for (const name of candidates) {
    const partial = await Artist.findOne({
      name: new RegExp(escapeRegex(name), 'i'),
    }).setOptions(BYPASS).lean();
    if (partial) return partial;
  }

  return null;
}

async function ensureArtist(template, { createMissing = true } = {}) {
  const existing = await findArtistByNames(template.artistNames);
  if (existing) return existing;
  if (!createMissing) return null;

  const name = template.artistNames[0];
  const created = await Artist.create({
    name,
    bio: `${name} official roster artist.`,
  });
  return created.toObject();
}

async function importArtistAnalyticsFromFile({
  filePath,
  filename,
  createMissing = true,
}) {
  const template = detectAnalyticsSheetTemplate(filename || filePath);
  if (!template) {
    const err = new Error('Unrecognized analytics CSV filename. Expected YUGM or Harshad Duhita Analytics sheet.');
    err.code = 'UNKNOWN_ANALYTICS_SHEET';
    throw err;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const { metrics, interests, periodLabel } = parseAnalyticsCsvText(text);
  if (!metrics.Followers) {
    const err = new Error('Analytics sheet missing Followers row');
    err.code = 'INVALID_ANALYTICS_SHEET';
    throw err;
  }

  const artist = await ensureArtist(template, { createMissing });
  if (!artist) {
    const err = new Error(`Artist not found for ${template.label}`);
    err.code = 'ARTIST_NOT_FOUND';
    throw err;
  }

  const capturedAt = parsePeriodDate(periodLabel);
  const instagramPatch = buildInstagramAnalytics(metrics, interests);

  const existing = await ArtistMetrics.findOne({ artistId: artist._id }).setOptions(BYPASS).lean();
  const mergedAnalytics = {
    ...(existing?.analytics || {}),
    instagram: {
      ...(existing?.analytics?.instagram || {}),
      ...instagramPatch,
      reelsPerformance: {
        ...(existing?.analytics?.instagram?.reelsPerformance || {}),
        ...instagramPatch.reelsPerformance,
      },
      stories: {
        ...(existing?.analytics?.instagram?.stories || {}),
        ...instagramPatch.stories,
      },
      demographics: instagramPatch.demographics,
    },
  };

  const historyEntry = {
    timestamp: capturedAt,
    platform: 'meta',
    metrics: {
      followers: instagramPatch.followers,
      engagementRate: instagramPatch.engagementRate,
      followerVelocity: instagramPatch.followerVelocity,
      avgLikes: instagramPatch.avgLikes,
    },
  };

  await ArtistMetrics.findOneAndUpdate(
    { artistId: artist._id },
    {
      $set: {
        artistId: artist._id,
        analytics: mergedAnalytics,
      },
      $push: {
        analyticsHistory: historyEntry,
      },
    },
    { upsert: true, new: true },
  ).setOptions(BYPASS);

  await ArtistAudienceSnapshot.findOneAndUpdate(
    {
      artistId: artist._id,
      platform: 'instagram',
      capturedAt,
    },
    {
      $set: {
        artistId: artist._id,
        platform: 'instagram',
        capturedAt,
        followers: instagramPatch.followers,
        reach: instagramPatch.stories.reach,
        demographics: instagramPatch.demographics,
      },
    },
    { upsert: true, new: true },
  ).setOptions(BYPASS);

  return {
    artistId: artist._id,
    artistName: artist.name,
    template: template.id,
    periodLabel,
    followers: instagramPatch.followers,
    engagementRate: instagramPatch.engagementRate,
  };
}

module.exports = {
  parseAnalyticsCsvText,
  parseMetricNumber,
  parseGrowthMetric,
  buildInstagramAnalytics,
  detectAnalyticsSheetTemplate,
  importArtistAnalyticsFromFile,
  findArtistByNames,
};
