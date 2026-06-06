const { categoryLabel, NEWSLETTER_ARTICLE_CATEGORIES } = require('../constants/newsletterCategories');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const truncate = (text, max) => {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
};

const renderArticleCard = (article) => {
  const title = escapeHtml(article.title || article.url);
  const description = escapeHtml(truncate(article.description, 220));
  const url = escapeHtml(article.url);
  const imageBlock = article.imageUrl
    ? `<tr>
        <td style="padding:0 0 12px 0;">
          <a href="${url}" style="text-decoration:none;">
            <img src="${escapeHtml(article.imageUrl)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:6px;border:1px solid #334155;" />
          </a>
        </td>
      </tr>`
    : '';

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background-color:#0f172a;border:1px solid #334155;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:16px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          ${imageBlock}
          <tr>
            <td>
              <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(article.siteName || 'Article')}</p>
              <h3 style="margin:0 0 8px 0;font-size:16px;line-height:1.35;color:#f8fafc;font-weight:700;">${title}</h3>
              ${description ? `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.55;color:#cbd5e1;">${description}</p>` : ''}
              <a href="${url}" style="display:inline-block;background:#126d5e;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:6px;">Read article</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
};

const compileNewsletterHtml = ({ issue, articles = [] }) => {
  const introTitle = escapeHtml(issue.introTitle || 'This Week at the Collective');
  const introBlurb = escapeHtml(issue.introBlurb || '');
  const weekLabel = escapeHtml(issue.weekKey || 'Weekly Digest');

  const grouped = NEWSLETTER_ARTICLE_CATEGORIES.map((cat) => ({
    ...cat,
    items: articles.filter((a) => a.category === cat.key),
  })).filter((group) => group.items.length > 0);

  const sectionsHtml = grouped.map((group) => {
    const cards = group.items.map(renderArticleCard).join('\n');
    return `<tr>
      <td style="padding:8px 0 4px 0;">
        <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(group.label)}</p>
        ${cards}
      </td>
    </tr>`;
  }).join('\n');

  const emptyState = sectionsHtml
    ? sectionsHtml
    : `<tr><td style="padding:12px 0;color:#94a3b8;font-size:14px;">No articles included in this issue yet.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${introTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden;">
          <tr align="center" style="background-color:#1e293b;border-bottom:1px solid #334155;">
            <td align="center" style="padding:28px 24px;">
              <h1 style="font-size:22px;font-weight:700;color:#2dd4bf;margin:0;text-transform:uppercase;letter-spacing:0.08em;">SHAKTI DIGEST</h1>
              <p style="font-size:11px;color:#94a3b8;margin:6px 0 0 0;text-transform:uppercase;letter-spacing:0.12em;">${weekLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="font-size:13px;color:#94a3b8;margin:0 0 8px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Update for {{name}}</p>
              <h2 style="font-size:20px;font-weight:700;color:#f8fafc;margin:0 0 16px 0;">${introTitle}</h2>
              ${introBlurb ? `<p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">${introBlurb}</p>` : ''}
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                ${emptyState}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0f172a;padding:20px;font-size:11px;color:#64748b;border-top:1px solid #334155;">
              <p style="margin:0 0 6px 0;">The Shakti Collective · indigenously rooted music</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#2dd4bf;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = {
  compileNewsletterHtml,
  categoryLabel,
};
