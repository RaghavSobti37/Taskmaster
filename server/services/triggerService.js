const Lead = require('../models/Lead');
const Project = require('../models/Project');
const logger = require('../utils/logger');

let TriggerClientRef = null;
let eventTriggerRef = null;
let scheduleTriggerRef = null;

try {
  const sdk = require('@trigger.dev/sdk');
  TriggerClientRef = sdk.TriggerClient;
  eventTriggerRef = sdk.eventTrigger;
  scheduleTriggerRef = sdk.scheduleTrigger;
} catch (err) {}

// Fallback mock client if SDK is v3/v4 or missing TriggerClient
class MockTriggerClient {
  constructor(options) {
    this.options = options;
  }
  defineJob(job) {
    logger.info('Trigger.dev', `Registered background job: ${job.name} (${job.id})`);
  }
  async sendEvent(event) {
    logger.info('Trigger.dev', `Simulated sendEvent: ${event.name}`);
    return true;
  }
}

const ClientConstructor = TriggerClientRef || MockTriggerClient;
const eventTrigger = eventTriggerRef || ((opts) => opts);
const scheduleTrigger = scheduleTriggerRef || ((opts) => opts);

const triggerApiKey = process.env.TRIGGER_API_KEY || 'tr_mock_api_key';
const triggerClient = new ClientConstructor({
  id: 'coreknot-coreknot',
  apiKey: triggerApiKey,
  apiUrl: process.env.TRIGGER_API_URL || 'https://api.trigger.dev',
});

// 1. Campaign email dispatch moved to auto-mailer (services/campaignEmailQueue.js)
//    Campaign dispatch trigger removed: processEmailJob was deleted from CoreKnot

// 2. Scheduled Daily Analytics Rollup
triggerClient.defineJob({
  id: 'daily-analytics-rollup',
  name: 'Daily Analytics Rollup & Lead Enrichment',
  version: '1.0.0',
  trigger: scheduleTrigger({
    cron: '0 0 * * *', // Every midnight
  }),
  run: async (payload, io, ctx) => {
    const logInfo = io?.logger?.info ? (msg) => io.logger.info(msg) : (msg) => logger.info('Job', msg);
    
    await logInfo('Executing scheduled daily analytics rollup');
    const totalLeads = await Lead.countDocuments();
    const activeProjects = await Project.countDocuments({ status: { $ne: 'Completed' } });
    await logInfo(`Rollup metrics: Total Leads=${totalLeads}, Active Projects=${activeProjects}`);
    return { totalLeads, activeProjects };
  },
});

// triggerEmailCampaign removed — campaign dispatch is now in auto-mailer

module.exports = {
  triggerClient,
};
