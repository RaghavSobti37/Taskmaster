const { OutreachCampaign, ContentArticle } = require('../models');
const { chatCompletion } = require('./aiClient');

const TIER_TEMPLATES = {
  tier1_guest: 'Guest post / music blog outreach',
  tier2_directory: 'Business directory & profile listings',
  tier3_pr: 'PR announcement for launches and events',
  tier4_embed: 'Embeddable widgets and artist cards',
  tier5_asset: 'Research reports and infographics',
};

async function createOutreachCampaign({ articleId, tier, prospects = [] }) {
  const article = articleId ? await ContentArticle.findById(articleId).lean() : null;
  const name = article
    ? `${TIER_TEMPLATES[tier] || tier}: ${article.title}`
    : `${TIER_TEMPLATES[tier] || tier} campaign`;

  const enrichedProspects = [];
  for (const p of prospects) {
    let emailDraft = p.emailDraft;
    if (!emailDraft && article) {
      const llm = await chatCompletion({
        system: 'Write a short, personalized outreach email. No spam. Reference specific value.',
        user: `Prospect: ${p.name} at ${p.organization}\nArticle: ${article.title}\nURL: ${article.canonicalUrl}\nWrite email subject + body.`,
        maxTokens: 800,
      });
      emailDraft = llm.ok ? llm.text : `Hi ${p.name},\n\nWe published a resource that may interest ${p.organization}: ${article.title}\n${article.canonicalUrl}\n\nBest,\nThe Shakti Collective`;
    }
    enrichedProspects.push({ ...p, emailDraft, status: 'pending' });
  }

  return OutreachCampaign.create({
    articleId,
    tier,
    name,
    status: 'draft',
    prospects: enrichedProspects,
  });
}

async function approveOutreachSend(campaignId, prospectIndex) {
  const campaign = await OutreachCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  const prospect = campaign.prospects[prospectIndex];
  if (!prospect) throw new Error('Prospect not found');
  prospect.status = 'approved_for_send';
  await campaign.save();
  return campaign.toObject();
}

module.exports = { createOutreachCampaign, approveOutreachSend, TIER_TEMPLATES };
