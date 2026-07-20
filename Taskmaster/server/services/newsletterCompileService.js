const { categoryLabel } = require('../constants/newsletterCategories');

const PRODUCTION_AUTO_MAILER_URL = 'https://auto-mailer-blue.vercel.app';

function resolveAutoMailerNewsletterUrl() {
  return `${String(process.env.AUTO_MAILER_URL || PRODUCTION_AUTO_MAILER_URL).trim().replace(/\/$/, '')}/campaigns`;
}

function createNewsletterMovedError() {
  const err = new Error('Newsletter email composition moved to Auto-Mailer');
  err.status = 410;
  err.service = 'auto-mailer';
  err.url = resolveAutoMailerNewsletterUrl();
  return err;
}

function compileNewsletterHtml() {
  throw createNewsletterMovedError();
}

module.exports = {
  compileNewsletterHtml,
  categoryLabel,
  createNewsletterMovedError,
  resolveAutoMailerNewsletterUrl,
};
