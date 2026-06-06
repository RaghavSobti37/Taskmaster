const { z } = require('zod');
const { CATEGORY_KEYS } = require('../../constants/newsletterCategories');
const { INLET_KEYS } = require('../../../shared/dataInlets');

const urlSchema = z.string().url().max(2048);

const previewLinkBody = z.object({
  url: urlSchema,
});

const createArticleBody = z.object({
  url: urlSchema,
  category: z.enum(CATEGORY_KEYS).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().max(2048).optional(),
  siteName: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  issueId: z.string().optional(),
});

const patchArticleBody = z.object({
  category: z.enum(CATEGORY_KEYS).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().max(2048).optional(),
  siteName: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  included: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  fetchStatus: z.enum(['pending', 'success', 'failed', 'manual']).optional(),
});

const curateIssueBody = z.object({
  introTitle: z.string().max(300).optional(),
  introBlurb: z.string().max(3000).optional(),
  status: z.enum(['collecting', 'curating', 'ready', 'archived']).optional(),
  articles: z.array(z.object({
    id: z.string(),
    sortOrder: z.number().int().min(0).optional(),
    included: z.boolean().optional(),
  })).optional(),
});

const audienceSchema = z.object({
  newsletterSubscribers: z.boolean().optional(),
  artistPath: z.boolean().optional(),
  exlyOfferingIds: z.array(z.string()).optional(),
  dataHubFolders: z.array(z.enum(INLET_KEYS)).optional(),
  manualEmails: z.array(z.string().email()).optional(),
});

const sendIssueBody = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  senderProfileId: z.string().optional(),
  senderMode: z.enum(['single', 'pool', 'system_resend', 'system_smtp']).optional(),
  senderProfileIds: z.array(z.string()).optional(),
  systemProvider: z.enum(['resend', 'env_smtp']).optional(),
  includeSignature: z.boolean().optional(),
  audience: audienceSchema,
  excludedEmails: z.array(z.string().email()).optional(),
});

const audiencePreviewBody = z.object({
  audience: audienceSchema,
  excludedEmails: z.array(z.string().email()).optional(),
});

module.exports = {
  previewLinkBody,
  createArticleBody,
  patchArticleBody,
  curateIssueBody,
  sendIssueBody,
  audiencePreviewBody,
};
