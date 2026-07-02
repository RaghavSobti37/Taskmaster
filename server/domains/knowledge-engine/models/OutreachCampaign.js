const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const outreachCampaignSchema = new mongoose.Schema(
  {
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentArticle', index: true },
    tier: { type: String, enum: ['tier1_guest', 'tier2_directory', 'tier3_pr', 'tier4_embed', 'tier5_asset'], default: 'tier1_guest' },
    name: { type: String, required: true, trim: true },
    status: { type: String, default: 'draft', enum: ['draft', 'active', 'paused', 'completed'] },
    prospects: [{
      name: String,
      email: String,
      organization: String,
      url: String,
      status: { type: String, default: 'pending' },
      emailDraft: String,
      followUpDraft: String,
      repliedAt: Date,
      notes: String,
    }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

outreachCampaignSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OutreachCampaign', outreachCampaignSchema);
