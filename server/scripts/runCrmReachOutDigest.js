#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const envCandidates = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.render'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { runCrmReachOutDigest } = require('../services/crmReachOutDigestService');

const isEnabled = () => {
  const flag = (process.env.CRM_REACH_OUT_DIGEST_ENABLED || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
};

const parseArg = (flag) => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
};

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  const forceSend = process.argv.includes('--force');
  const useProd = process.argv.includes('--prod');
  const testMode = process.argv.includes('--test') || Boolean(parseArg('--to'));
  const recipient = parseArg('--to');
  const lookbackDays = parseInt(parseArg('--days') || '1', 10) || 1;

  if (!isEnabled() && !dryRun && !forceSend && !testMode) {
    logger.info('CrmReachOutDigest', 'CRM_REACH_OUT_DIGEST_ENABLED=false — skipping run');
    process.exit(0);
  }

  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);
  if (!uri) {
    logger.error('CrmReachOutDigest', 'MONGODB_URI not configured');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri.trim(), { serverSelectionTimeoutMS: 20000 });
    logger.info('CrmReachOutDigest', dryRun ? 'Starting dry-run digest' : 'Starting CRM reach-out digest', {
      lookbackDays,
      recipient: recipient || '(default)',
      testMode,
    });

    const result = await runCrmReachOutDigest({
      dryRun,
      forceSend: forceSend || dryRun || testMode,
      lookbackDays,
      recipient,
      testMode,
      skipLock: testMode,
    });

    logger.info('CrmReachOutDigest', 'Digest run completed', result);
    await mongoose.disconnect();
    process.exit(result.sent || dryRun ? 0 : 1);
  } catch (error) {
    logger.error('CrmReachOutDigest', 'Digest run failed', { error: error.message });
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
};

main();
