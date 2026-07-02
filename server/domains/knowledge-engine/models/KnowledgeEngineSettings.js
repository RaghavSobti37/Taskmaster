const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const knowledgeEngineSettingsSchema = new mongoose.Schema(
  {
    brandVoice: { type: String, default: '' },
    bannedPhrases: [{ type: String }],
    minPublishScore: { type: Number, default: 80 },
    evergreenPerWeek: { type: Number, default: 4 },
    shortsPerWeek: { type: Number, default: 7 },
    targetWordCountMin: { type: Number, default: 1200 },
    targetWordCountMax: { type: Number, default: 1800 },
    requireHumanApproval: { type: Boolean, default: true },
    maxArticlesPerDay: { type: Number, default: 5 },
    siteBaseUrl: { type: String, default: 'https://theshakticollective.in' },
    contentTypePrompts: { type: mongoose.Schema.Types.Mixed, default: {} },
    notifyEmail: { type: String, trim: true },
    notifySlackWebhook: { type: String, trim: true },
  },
  { timestamps: true },
);

knowledgeEngineSettingsSchema.plugin(tenantPlugin);

module.exports = mongoose.model('KnowledgeEngineSettings', knowledgeEngineSettingsSchema);
