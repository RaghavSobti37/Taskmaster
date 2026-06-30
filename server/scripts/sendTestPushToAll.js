#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { broadcastTestPush } = require('../services/pushNotificationService');

const runProd = process.argv.includes('--prod');

const resolveMongoUri = () => {
  if (runProd) {
    return process.env.MONGODB_URI_PROD || process.env.MONGODB_URI;
  }
  return process.env.MONGODB_URI || process.env.MONGO_URI;
};

const main = async () => {
  const uri = resolveMongoUri();
  if (!uri) {
    logger.error('SendTestPush', runProd ? 'MONGODB_URI_PROD not configured' : 'MONGODB_URI not configured');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri.trim(), { serverSelectionTimeoutMS: 20000 });
    logger.info('SendTestPush', `Connected (${runProd ? 'production' : 'local'})`);

    const result = await broadcastTestPush();
    console.log(JSON.stringify({
      ok: result.ok,
      users: result.users,
      devices: result.devices,
      sent: result.sent,
      failed: result.failed,
      notificationId: result.notificationId,
      title: result.title,
      body: result.body,
      error: result.error,
    }, null, 2));

    if (result.deliveries?.length) {
      console.log('\nPer-device results:');
      for (const row of result.deliveries) {
        const who = row.email || row.name || row.userId;
        const status = row.status === 'sent'
          ? 'SENT'
          : `FAILED (${row.statusCode || 'n/a'}: ${row.error || 'unknown'})`;
        console.log(`- ${who} | ${row.bucket} | ${status}`);
        console.log(`  ${row.endpoint}`);
      }
    } else if (result.ok) {
      console.log('\nNo registered push devices found.');
    }

    if (!result.ok) {
      process.exit(1);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('SendTestPush', 'Broadcast failed', { error: error.message });
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
};

main();
