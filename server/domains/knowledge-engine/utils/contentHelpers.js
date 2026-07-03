const crypto = require('crypto');

const SITE_BASE = process.env.TSC_SITE_BASE_URL || 'https://theshakticollective.in';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function estimateReadTime(markdown) {
  const words = String(markdown || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function contentHash(body) {
  return crypto.createHash('sha256').update(String(body || '')).digest('hex').slice(0, 32);
}

function buildCanonicalUrl(slug) {
  return `${SITE_BASE.replace(/\/$/, '')}/insights/${slug}`;
}

function toPublicArticle(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug,
    excerpt: o.excerpt || '',
    metaDescription: o.metaDescription || o.excerpt || '',
    authorName: o.authorName || 'The Shakti Collective',
    readTimeMinutes: o.readTimeMinutes || estimateReadTime(o.bodyMarkdown),
    category: o.category || 'insights',
    tags: o.tags || [],
    heroImageUrl: o.heroImageUrl || '',
    ogImageUrl: o.ogImageUrl || o.heroImageUrl || '',
    canonicalUrl: o.canonicalUrl || buildCanonicalUrl(o.slug),
    mediumUrl: o.mediumUrl || '',
    publishedAt: o.publishedAt,
    updatedAt: o.updatedAt,
    bodyMarkdown: o.bodyMarkdown || '',
    faq: o.faq || [],
    schemaJsonLd: o.schemaJsonLd || [],
  };
}

function toPublicListItem(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug,
    excerpt: o.excerpt || '',
    heroImageUrl: o.heroImageUrl || '',
    readTimeMinutes: o.readTimeMinutes || estimateReadTime(o.bodyMarkdown),
    publishedAt: o.publishedAt,
    category: o.category || 'insights',
    link: `/insights/${o.slug}`,
    mediumUrl: o.mediumUrl || '',
  };
}

module.exports = {
  slugify,
  estimateReadTime,
  contentHash,
  buildCanonicalUrl,
  toPublicArticle,
  toPublicListItem,
  SITE_BASE,
};
