const { buildCanonicalUrl } = require('../utils/contentHelpers');

function generateArticleSchema(article, settings) {
  const siteBase = settings?.siteBaseUrl || process.env.TSC_SITE_BASE_URL || 'https://theshakticollective.in';
  const url = article.canonicalUrl || buildCanonicalUrl(article.slug);
  const schemas = [];

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    author: {
      '@type': 'Organization',
      name: article.authorName || 'The Shakti Collective',
    },
    publisher: {
      '@type': 'Organization',
      name: 'The Shakti Collective',
      url: siteBase,
      logo: {
        '@type': 'ImageObject',
        url: `${siteBase}/assets/logo.png`,
      },
    },
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt || article.publishedAt,
    image: article.heroImageUrl || article.ogImageUrl || `${siteBase}/assets/logo.png`,
    mainEntityOfPage: url,
  });

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteBase },
      { '@type': 'ListItem', position: 2, name: 'Resources', item: `${siteBase}/resources` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  });

  if (Array.isArray(article.faq) && article.faq.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteBase}/#organization`,
    name: 'The Shakti Collective',
    alternateName: ['TSC', 'TSC Academy'],
    url: siteBase,
    knowsAbout: ['Music Composition', 'Artist Incubation', 'Live Music', 'Music Education'],
  });

  return schemas;
}

module.exports = { generateArticleSchema };
