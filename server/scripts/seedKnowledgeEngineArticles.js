/**
 * Seed legacy TSC insight articles into ContentArticle (idempotent).
 * Run: node server/scripts/seedKnowledgeEngineArticles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { ContentArticle } = require('../domains/knowledge-engine/models');
const { buildCanonicalUrl } = require('../domains/knowledge-engine/utils/contentHelpers');

const LEGACY_POSTS = [
  {
    title: 'Is an Online Music Course Worth It for Beginners?',
    slug: 'online-music-course-beginners',
    excerpt: 'Yes — but not for every beginner. When online music courses work, what makes them worth it, and who should join one.',
    heroImageUrl: '/assets/blog/online-music-course-beginners.png',
    readTimeMinutes: 7,
    authorName: 'Rohit Sobti',
    publishedAt: new Date('2026-06-27'),
    bodyMarkdown: 'Short answer: Yes — but not for every beginner.\n\nAn online music course can be deeply worth it for someone who truly loves music and is willing to practise seriously.',
  },
  {
    title: 'The Artist Release Playbook',
    slug: 'artist-release-playbook',
    excerpt: 'How to release your music without it getting lost. Pre-release, release day, and post-release strategies.',
    heroImageUrl: '/assets/Patterns/LogoArtboard 17@300x-8.png',
    readTimeMinutes: 6,
    publishedAt: new Date('2026-05-02'),
    bodyMarkdown: 'Releasing music is a system, not a single day. This playbook covers what to do before, during, and after your release.',
  },
  {
    title: 'Breathing Techniques & Vocal Texture',
    slug: 'breathing-vocal-texture',
    excerpt: 'Most singers think their problem is pitch. It is breath. Practical ways to improve vocal texture.',
    heroImageUrl: '/assets/Patterns/LogoArtboard 18@300x-8.png',
    readTimeMinutes: 5,
    publishedAt: new Date('2026-05-02'),
    bodyMarkdown: 'Breath is the foundation of tone. These exercises help you control airflow and enrich your vocal texture.',
  },
  {
    title: 'The Daily Riyaaz Routine',
    slug: 'daily-riyaaz-routine',
    excerpt: 'A practical guide to improving your voice when you only have 20 minutes a day.',
    heroImageUrl: '/assets/Patterns/LogoArtboard 19@300x-8.png',
    readTimeMinutes: 7,
    publishedAt: new Date('2026-05-02'),
    bodyMarkdown: 'Consistency beats marathon sessions. Here is a simple daily riyaaz structure for busy artists.',
  },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI required');
  await mongoose.connect(uri);
  let created = 0;
  for (const post of LEGACY_POSTS) {
    const exists = await ContentArticle.findOne({ slug: post.slug }).setOptions({ bypassTenant: true });
    if (exists) continue;
    await ContentArticle.create({
      ...post,
      status: 'published',
      category: 'insights',
      metaDescription: post.excerpt,
      canonicalUrl: buildCanonicalUrl(post.slug),
      qualityScore: 85,
    });
    created += 1;
  }
  console.log(`Seed complete. Created ${created} articles.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
