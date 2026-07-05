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
    title: 'How Do I Start Making Music if I Have No Experience?',
    slug: 'how-to-start-making-music-no-experience',
    excerpt:
      'A lot of people feel drawn to music but do not know where to begin. Start with why you want to connect with music — then listen deeply before you try to create.',
    heroImageUrl: '/assets/blog/how-to-start-making-music-no-experience.png',
    mediumUrl: 'https://rohitsobti1.medium.com/how-do-i-start-making-music-if-i-have-no-experience-9c42a7409cd5',
    bodyMarkdown:
      'Before asking how to make music, ask why you want to connect with music. Your first teacher is deep listening — notice what moves you before you try to create.',
  },
  {
    title: 'Is an Online Music Course Worth It for Beginners?',
    slug: 'online-music-course-beginners',
    excerpt: 'Yes — but not for every beginner. When online music courses work, what makes them worth it, and who should join one.',
    heroImageUrl: '/assets/blog/online-music-course-beginners.png',
    mediumUrl: 'https://rohitsobti1.medium.com/is-an-online-music-course-worth-it-for-beginners-1d343de7f532',
    bodyMarkdown: 'Short answer: Yes — but not for every beginner.\n\nAn online music course can be deeply worth it for someone who truly loves music and is willing to practise seriously.',
  },
  {
    title: 'The Artist Release Playbook',
    slug: 'artist-release-playbook',
    excerpt: 'How to release your music without it getting lost. Pre-release, release day, and post-release strategies.',
    heroImageUrl: '/assets/blog/artist-release-playbook.png',
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
