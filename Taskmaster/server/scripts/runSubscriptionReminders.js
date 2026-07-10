#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { runSubscriptionReminders } = require('../services/subscriptionReminderService');

const isEnabled = () => {
  const flag = (process.env.SUBSCRIPTION_REMINDERS_ENABLED || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
};

const main = async () => {
  if (!isEnabled()) {
    logger.info('SubscriptionReminders', 'SUBSCRIPTION_REMINDERS_ENABLED=false — skipping run');
    process.exit(0);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    logger.error('SubscriptionReminders', 'MONGODB_URI not configured');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri.trim(), { serverSelectionTimeoutMS: 20000 });
    logger.info('SubscriptionReminders', 'Starting scheduled subscription reminder run');

    const result = await runSubscriptionReminders();

    logger.info('SubscriptionReminders', 'Reminder run completed', result);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('SubscriptionReminders', 'Reminder run failed', { error: error.message });
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore disconnect errors
    }
    process.exit(1);
  }
};

main();
