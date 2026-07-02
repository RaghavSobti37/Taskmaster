const crypto = require('crypto');
const axios = require('axios');
const Artist = require('../../../models/Artist');
const Lead = require('../../../domains/crm/models/Lead');
const {
  KnowledgeChunk,
  KnowledgeSource,
  PipelineRun,
} = require('../models');
const { contentHash } = require('../utils/contentHelpers');

const DEFAULT_WEBSITE_BASE = process.env.TSC_SITE_BASE_URL || 'https://theshakticollective.in';

async function upsertChunk({ sourceType, sourceId, sourceUrl, title, body, excerpt, entities, metadata }) {
  const hash = contentHash(body);
  const existing = await KnowledgeChunk.findOne({ sourceType, sourceId, contentHash: hash });
  if (existing) return existing;
  return KnowledgeChunk.findOneAndUpdate(
    { sourceType, sourceId },
    {
      sourceType,
      sourceId,
      sourceUrl,
      title,
      body,
      excerpt: excerpt || String(body).slice(0, 280),
      entities: entities || [],
      metadata: metadata || {},
      contentHash: hash,
      fetchedAt: new Date(),
    },
    { upsert: true, new: true },
  );
}

async function markSource(type, patch) {
  return KnowledgeSource.findOneAndUpdate(
    { type },
    { type, label: patch.label || type, ...patch },
    { upsert: true, new: true },
  );
}

async function ingestWebsite() {
  const run = await PipelineRun.create({ jobType: 'knowledge-ingest-website', status: 'running' });
  let count = 0;
  try {
    const sitemapUrl = `${DEFAULT_WEBSITE_BASE.replace(/\/$/, '')}/sitemap.xml`;
    const sitemapRes = await axios.get(sitemapUrl, { timeout: 30000 });
    const urls = [...String(sitemapRes.data).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const limited = urls.slice(0, 40);
    for (const url of limited) {
      try {
        const pageRes = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': 'CoreKnot-KnowledgeBot/1.0' } });
        const html = String(pageRes.data);
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : url;
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12000);
        if (text.length < 80) continue;
        await upsertChunk({
          sourceType: 'website',
          sourceId: url,
          sourceUrl: url,
          title,
          body: text,
          metadata: { ingestedFrom: 'sitemap' },
        });
        count += 1;
      } catch {
        // skip unreachable pages
      }
    }
    await markSource('website', { status: 'ok', lastSyncAt: new Date(), label: 'TSC Website' });
    run.status = 'completed';
    run.output = { pagesIngested: count };
    run.completedAt = new Date();
    await run.save();
    return { pagesIngested: count };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    await markSource('website', { status: 'error', lastError: err.message, lastSyncAt: new Date() });
    throw err;
  }
}

async function ingestCrmAndArtists() {
  const run = await PipelineRun.create({ jobType: 'knowledge-ingest-crm', status: 'running' });
  let count = 0;
  try {
    const artists = await Artist.find().limit(200).select('name slug bio genre city socials achievements').lean();
    for (const artist of artists) {
      const body = [
        artist.name,
        artist.bio,
        artist.genre,
        artist.city,
        Array.isArray(artist.achievements) ? artist.achievements.join('. ') : '',
      ].filter(Boolean).join('\n');
      if (!body.trim()) continue;
      await upsertChunk({
        sourceType: 'artist',
        sourceId: String(artist._id),
        sourceUrl: artist.slug ? `${DEFAULT_WEBSITE_BASE}/${artist.slug}` : '',
        title: `Artist: ${artist.name}`,
        body,
        entities: [artist.name, artist.genre].filter(Boolean),
        metadata: { slug: artist.slug },
      });
      count += 1;
    }
    const leads = await Lead.find({ status: { $ne: 'inactive' } }).limit(100).select('name notes source campaign').lean();
    for (const lead of leads) {
      if (!lead.notes) continue;
      await upsertChunk({
        sourceType: 'crm',
        sourceId: String(lead._id),
        title: `CRM lead: ${lead.name || 'Unknown'}`,
        body: `${lead.name || ''}\n${lead.notes}\nSource: ${lead.source || ''}`,
        metadata: { campaign: lead.campaign },
      });
      count += 1;
    }
    await markSource('crm', { status: 'ok', lastSyncAt: new Date(), label: 'CoreKnot CRM & Artists' });
    run.status = 'completed';
    run.output = { recordsIngested: count };
    run.completedAt = new Date();
    await run.save();
    return { recordsIngested: count };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

async function runFullIngest() {
  const website = await ingestWebsite();
  const crm = await ingestCrmAndArtists();
  return { website, crm };
}

async function extractOpportunitySignals() {
  const run = await PipelineRun.create({ jobType: 'opportunity-extract', status: 'running' });
  const { ContentOpportunity } = require('../models');
  let created = 0;
  try {
    const recent = await KnowledgeChunk.find().sort({ fetchedAt: -1 }).limit(50).lean();
    for (const chunk of recent) {
      const title = `Explore: ${chunk.title}`.slice(0, 120);
      const exists = await ContentOpportunity.findOne({ title, primaryKeyword: chunk.sourceType });
      if (exists) continue;
      await ContentOpportunity.create({
        title,
        topic: chunk.title,
        primaryKeyword: chunk.sourceType,
        contentType: chunk.sourceType === 'artist' ? 'artist_story' : 'guide',
        sourceSignals: [chunk.sourceType, chunk.sourceId].filter(Boolean),
        scores: { relevance: 70, freshness: 75, businessValue: 60 },
        overallScore: 68,
        status: 'candidate',
      });
      created += 1;
    }
    run.status = 'completed';
    run.output = { created };
    run.completedAt = new Date();
    await run.save();
    return { created };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

module.exports = {
  upsertChunk,
  ingestWebsite,
  ingestCrmAndArtists,
  runFullIngest,
  extractOpportunitySignals,
};
