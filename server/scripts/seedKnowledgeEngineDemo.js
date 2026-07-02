/**
 * Full Knowledge Engine local demo — dummy data across all tabs.
 * Run from server/: node scripts/seedKnowledgeEngineDemo.js
 * Reset demo data first: node scripts/seedKnowledgeEngineDemo.js --reset
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  KnowledgeSource,
  KnowledgeChunk,
  KeywordCluster,
  ContentOpportunity,
  SeoBrief,
  ContentArticle,
  ContentCalendarEntry,
  ConnectedAccount,
  DistributionJob,
  OutreachCampaign,
  RankSnapshot,
  PipelineRun,
  KnowledgeEngineSettings,
} = require('../domains/knowledge-engine/models');
const { buildCanonicalUrl } = require('../domains/knowledge-engine/utils/contentHelpers');

const DEMO = 'knowledge-engine-demo-v1';
const BYPASS = { bypassTenant: true };

async function resetDemo() {
  const articles = await ContentArticle.find({ 'pipelineMeta.demoTag': DEMO }).setOptions(BYPASS).select('_id');
  const articleIds = articles.map((a) => a._id);
  await Promise.all([
    ContentArticle.deleteMany({ 'pipelineMeta.demoTag': DEMO }).setOptions(BYPASS),
    KnowledgeChunk.deleteMany({ 'metadata.demoTag': DEMO }).setOptions(BYPASS),
    KeywordCluster.deleteMany({ 'metadata.demoTag': DEMO }).setOptions(BYPASS),
    ContentOpportunity.deleteMany({ 'metadata.demoTag': DEMO }).setOptions(BYPASS),
    SeoBrief.deleteMany({ 'briefJson.demoTag': DEMO }).setOptions(BYPASS),
    ContentCalendarEntry.deleteMany({ notes: DEMO }).setOptions(BYPASS),
    ConnectedAccount.deleteMany({ label: /^DEMO:/ }).setOptions(BYPASS),
    DistributionJob.deleteMany({ 'metadata.demoTag': DEMO }).setOptions(BYPASS),
    OutreachCampaign.deleteMany({ 'metadata.demoTag': DEMO }).setOptions(BYPASS),
    RankSnapshot.deleteMany({ 'metadata.demoTag': DEMO }).setOptions(BYPASS),
    PipelineRun.deleteMany({ 'output.demoTag': DEMO }).setOptions(BYPASS),
    KnowledgeSource.deleteMany({ label: /^DEMO:/ }).setOptions(BYPASS),
  ]);
  if (articleIds.length) {
    await DistributionJob.deleteMany({ articleId: { $in: articleIds } }).setOptions(BYPASS);
    await OutreachCampaign.deleteMany({ articleId: { $in: articleIds } }).setOptions(BYPASS);
  }
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI or MONGODB_URI required');
  const reset = process.argv.includes('--reset');

  await mongoose.connect(uri);
  if (reset) {
    await resetDemo();
    console.log('Cleared prior demo data.');
  }

  await KnowledgeEngineSettings.findOneAndUpdate(
    {},
    {
      brandVoice: 'Warm, expert, artist-first. No hype. Practical steps for Indian independent musicians.',
      bannedPhrases: ['game-changer', 'unlock your potential'],
      minPublishScore: 80,
      requireHumanApproval: true,
      notifyEmail: 'demo@theshakticollective.in',
    },
    { upsert: true, new: true },
  ).setOptions(BYPASS);

  const sources = await KnowledgeSource.insertMany([
    { label: 'DEMO: TSC Website', type: 'website', status: 'ok', lastSyncAt: new Date() },
    { label: 'DEMO: CRM Artists', type: 'crm', status: 'ok', lastSyncAt: new Date() },
    { label: 'DEMO: Artist Reviews', type: 'manual', status: 'ok', lastSyncAt: new Date() },
  ]);

  await KnowledgeChunk.insertMany([
    {
      sourceType: 'website',
      sourceId: 'artist-path',
      sourceUrl: 'https://theshakticollective.in/artist-path',
      title: 'Artist Path — onboarding journey',
      body: 'The Artist Path maps emerging musicians through workshops, mentorship, and release support at TSC.',
      excerpt: 'TSC onboarding for independent artists',
      entities: ['Artist Path', 'TSC Academy', 'workshops'],
      metadata: { demoTag: DEMO },
    },
    {
      sourceType: 'crm',
      sourceId: 'artist-001',
      title: 'Featured artist — indie folk vocalist from Pune',
      body: 'Released debut EP in 2025; completed Hindustani vocal workshop; booking inquiries up 40% after TSC mentorship.',
      entities: ['Pune', 'indie folk', 'Hindustani vocal'],
      metadata: { demoTag: DEMO },
    },
    {
      sourceType: 'reviews',
      sourceId: 'masterclass-sandesh',
      title: 'Masterclass review — composition fundamentals',
      body: 'Students rated clarity 4.8/5. Common win: understanding song structure before production.',
      entities: ['composition', 'masterclass', 'Sandesh Shandilya'],
      metadata: { demoTag: DEMO },
    },
  ]);

  const cluster = await KeywordCluster.create({
    name: 'Online music courses India',
    pillarKeyword: 'online music course beginners',
    keywords: [
      { term: 'online music course beginners', volume: 2400, competition: 42, source: 'gsc' },
      { term: 'learn singing online india', volume: 1800, competition: 38, source: 'autocomplete' },
      { term: 'hindustani vocal classes online', volume: 1200, competition: 55, source: 'paa' },
    ],
    metadata: { demoTag: DEMO },
  });

  const opportunityHigh = await ContentOpportunity.create({
    title: 'How to choose an online music course in India (2026 guide)',
    topic: 'Online music education for beginners',
    contentType: 'guide',
    keywordClusterId: cluster._id,
    primaryKeyword: 'online music course beginners',
    scores: { volume: 88, competition: 62, authority: 75, businessValue: 92, trend: 70, relevance: 95, freshness: 80, gap: 85, intent: 90 },
    overallScore: 86,
    status: 'approved',
    sourceSignals: ['gsc_rising_query', 'crm_workshop_faq'],
    metadata: { demoTag: DEMO },
  });

  await ContentOpportunity.create({
    title: 'Daily riyaaz routine for working professionals',
    topic: 'Practice habits',
    contentType: 'how_to',
    primaryKeyword: 'daily riyaaz routine',
    scores: { volume: 70, competition: 45, authority: 80, businessValue: 78, trend: 65, relevance: 88, freshness: 72, gap: 70, intent: 85 },
    overallScore: 74,
    status: 'candidate',
    metadata: { demoTag: DEMO },
  });

  const brief = await SeoBrief.create({
    opportunityId: opportunityHigh._id,
    title: 'How to Choose an Online Music Course in India (2026)',
    slug: 'choose-online-music-course-india-2026',
    metaDescription: 'Practical checklist for Indian beginners comparing online music courses — cost, faculty, practice structure, and outcomes.',
    h1: 'How to Choose an Online Music Course in India',
    headings: [
      { level: 2, text: 'Who online courses work best for' },
      { level: 2, text: 'Red flags when comparing programs' },
      { level: 3, text: 'Faculty credentials vs marketing' },
    ],
    faq: [
      { question: 'Are online music courses worth it?', answer: 'Yes, when you have consistent practice time and clear goals.' },
    ],
    schemaTypes: ['Article', 'FAQPage', 'BreadcrumbList'],
    keywords: ['online music course', 'beginners india'],
    internalLinkTargets: [
      { url: '/artist-path', anchor: 'Artist Path', reason: 'primary CTA' },
      { url: '/book-a-call', anchor: 'book a call', reason: 'conversion' },
    ],
    cta: 'Take the Artist Path questionnaire',
    targetWordCount: 1500,
    status: 'approved',
    briefJson: { demoTag: DEMO },
  });

  const published = await ContentArticle.findOneAndUpdate(
    { slug: 'online-music-course-beginners' },
    {
      title: 'Is an Online Music Course Worth It for Beginners?',
      slug: 'online-music-course-beginners',
      status: 'published',
      contentType: 'guide',
      excerpt: 'Yes — but not for every beginner. When online music courses work, what makes them worth it, and who should join one.',
      metaDescription: 'Honest guide for Indian beginners evaluating online music courses.',
      bodyMarkdown: '# Is an Online Music Course Worth It?\n\n**Short answer:** Yes — if you practise consistently.\n\n## When it works\n\n- You have 20–30 minutes daily for riyaaz\n- You want structured feedback, not random YouTube tabs\n\n## When to wait\n\n- You cannot commit to weekly assignments\n\n[Take the Artist Path](/artist-path) to map your next step.',
      publishedAt: new Date('2026-06-27'),
      canonicalUrl: buildCanonicalUrl('online-music-course-beginners'),
      heroImageUrl: '/assets/blog/online-music-course-beginners.png',
      readTimeMinutes: 7,
      qualityScore: 88,
      mediumUrl: 'https://medium.com/@demo/example-online-music-course',
      schemaJsonLd: [{ '@type': 'Article', headline: 'Is an Online Music Course Worth It for Beginners?' }],
      faq: [{ question: 'How long before I see progress?', answer: 'Most students notice tone stability in 4–6 weeks of daily practice.' }],
      pipelineMeta: { demoTag: DEMO },
    },
    { upsert: true, new: true },
  ).setOptions(BYPASS);

  const reviewArticle = await ContentArticle.create({
    title: 'How to Release Your First Single Without Burning Out',
    slug: 'first-single-release-checklist-demo',
    status: 'review',
    contentType: 'how_to',
    excerpt: 'A 30-day release checklist for independent artists — demo draft awaiting approval.',
    bodyMarkdown: '# First Single Release Checklist\n\n## Week 1 — Master + metadata\n\n## Week 2 — Artwork + teaser\n\n## Week 3 — Distributor + pre-save',
    qualityScore: 82,
    opportunityId: opportunityHigh._id,
    briefId: brief._id,
    pipelineStage: 'readability',
    pipelineMeta: { demoTag: DEMO, factCheckFlags: [] },
  });

  await ContentArticle.create({
    title: 'Festival Season Prep for Independent Artists',
    slug: 'festival-season-prep-demo-draft',
    status: 'draft',
    contentType: 'festival_guide',
    excerpt: 'Draft — not visible on public API.',
    bodyMarkdown: '# Festival Season Prep\n\nDraft content for internal review only.',
    qualityScore: 0,
    pipelineMeta: { demoTag: DEMO },
  });

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 3);
  await ContentCalendarEntry.create({
    title: 'Publish: Online music course guide',
    scheduledDate: nextWeek,
    slotType: 'evergreen',
    contentType: 'guide',
    status: 'in_progress',
    articleId: reviewArticle._id,
    opportunityId: opportunityHigh._id,
    notes: DEMO,
  });

  await ConnectedAccount.insertMany([
    { provider: 'gsc', label: 'DEMO: Google Search Console', status: 'connected', lastSyncAt: new Date() },
    { provider: 'ga4', label: 'DEMO: Google Analytics 4', status: 'connected', lastSyncAt: new Date() },
    { provider: 'meta', label: 'DEMO: Instagram', status: 'disconnected' },
    { provider: 'linkedin', label: 'DEMO: LinkedIn', status: 'disconnected' },
  ]);

  await DistributionJob.insertMany([
    {
      articleId: published._id,
      platform: 'linkedin',
      status: 'ready',
      content: 'New on TSC: Is an online music course worth it for beginners? Practical checklist for Indian artists →',
      metadata: { demoTag: DEMO },
    },
    {
      articleId: published._id,
      platform: 'instagram',
      status: 'ready',
      content: 'Carousel hook: 3 signs you are ready for structured vocal training 🎵',
      metadata: { demoTag: DEMO },
    },
    {
      articleId: published._id,
      platform: 'newsletter',
      status: 'pending',
      content: 'Snippet for weekly artist digest — pending editor copy.',
      metadata: { demoTag: DEMO },
    },
  ]);

  await OutreachCampaign.create({
    articleId: published._id,
    tier: 'tier1_guest',
    name: 'DEMO: Guest post — music education blogs',
    status: 'active',
    prospects: [
      {
        name: 'Editor — Indie Music India',
        email: 'editor@example.com',
        organization: 'Indie Music India',
        status: 'pending',
        emailDraft: 'Hi — we published a practical guide on online music courses for beginners. Would a guest excerpt fit your education column?',
      },
    ],
    metadata: { demoTag: DEMO },
  });

  await RankSnapshot.create({
    articleId: published._id,
    keyword: 'online music course beginners',
    position: 14,
    impressions: 420,
    clicks: 18,
    ctr: 0.043,
    snapshotDate: new Date(),
    metadata: { demoTag: DEMO },
  });

  await PipelineRun.create({
    jobType: 'knowledge-ingest',
    status: 'completed',
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(),
    output: { demoTag: DEMO, summary: 'Demo ingest: 3 chunks from website, CRM, reviews' },
  });

  console.log('\n✓ Knowledge Engine demo seeded\n');
  console.log('Admin UI:  http://localhost:5173/admin/knowledge-engine');
  console.log('           (needs admin_data or admin_knowledge_engine permission)\n');
  console.log('Public API:');
  console.log('  GET http://localhost:5000/api/public/content/posts');
  console.log('  GET http://localhost:5000/api/public/content/posts/online-music-course-beginners\n');
  console.log('Website (set TSC_API_URL=http://localhost:5000 in website/TSC-Website/.env.local):');
  console.log('  http://localhost:3000/resources');
  console.log('  http://localhost:3000/insights/online-music-course-beginners\n');
  console.log(`Sources: ${sources.length} | Chunks: 3 | Keywords cluster: 1 | Opportunities: 2`);
  console.log(`Articles: 1 published, 1 review, 1 draft | Calendar: 1 | Distribution: 3`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
