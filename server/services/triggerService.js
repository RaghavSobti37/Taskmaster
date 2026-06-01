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

// 1. Background Mail Campaign Dispatch Task
triggerClient.defineJob({
  id: 'mail-dispatch-job',
  name: 'Mail Campaign Dispatch',
  version: '1.0.0',
  trigger: eventTrigger({
    name: 'mail.dispatch',
  }),
  run: async (payload, io, ctx) => {
    const logInfo = io?.logger?.info ? (msg) => io.logger.info(msg) : (msg) => logger.info('Job', msg);
    const logError = io?.logger?.error ? (msg) => io.logger.error(msg) : (msg) => logger.error('Job', msg);
    
    await logInfo(`Starting email dispatch for campaign ${payload.campaignId}`);
    try {
      const { processEmailJob } = require('./emailProcessor');
      await processEmailJob(payload);
      await logInfo(`Successfully processed email to ${payload.email}`);
      return { status: 'completed', email: payload.email };
    } catch (err) {
      await logError(`Error processing email to ${payload.email}: ${err.message}`);
      throw err;
    }
  },
});

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

const triggerEmailCampaign = async (jobData) => {
  if (triggerApiKey && triggerApiKey !== 'tr_mock_api_key' && TriggerClientRef) {
    await triggerClient.sendEvent({
      name: 'mail.dispatch',
      payload: jobData,
    });
    logger.info('Trigger.dev', `Queued event mail.dispatch for ${jobData.email}`);
    return true;
  }
  return false;
};

module.exports = {
  triggerClient,
  triggerEmailCampaign,
};
