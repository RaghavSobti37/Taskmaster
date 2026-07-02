const request = require('supertest');
const app = require('../server');
const { ContentArticle } = require('../domains/knowledge-engine/models');
const { buildCanonicalUrl } = require('../domains/knowledge-engine/utils/contentHelpers');

describe('Public content API', () => {
  const slug = `test-insight-${Date.now()}`;

  beforeEach(async () => {
    await ContentArticle.create({
      title: 'Test Insight Article',
      slug,
      status: 'published',
      excerpt: 'Test excerpt for public API',
      metaDescription: 'Test meta',
      bodyMarkdown: '# Hello\n\nTest body content.',
      publishedAt: new Date(),
      canonicalUrl: buildCanonicalUrl(slug),
      category: 'insights',
      qualityScore: 90,
    });
  });

  afterEach(async () => {
    await ContentArticle.deleteMany({ slug });
  });

  it('GET /api/public/content/posts returns published list', async () => {
    const res = await request(app).get('/api/public/content/posts');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((p) => p.slug === slug)).toBe(true);
  });

  it('GET /api/public/content/posts/:slug returns full post', async () => {
    const res = await request(app).get(`/api/public/content/posts/${slug}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.post.slug).toBe(slug);
    expect(res.body.post.bodyMarkdown).toContain('Hello');
  });

  it('GET /api/public/content/posts/:slug returns 404 for missing slug', async () => {
    const res = await request(app).get('/api/public/content/posts/does-not-exist-xyz');
    expect(res.statusCode).toBe(404);
  });
});
