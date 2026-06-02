const mongoose = require('mongoose');
const QATestRun = require('../models/QATestRun');
const QATestingService = require('../services/qaTestingService');
require('dotenv').config();

const dbUri =
  process.env.QA_SCAN_MONGODB_URI
  || process.env.MONGODB_URI
  || process.env.MONGODB_URI_PROD
  || 'mongodb://localhost:27017/testing';

async function run() {
  console.log('Connecting to database:', dbUri.replace(/\/\/.*:.*@/, '//****:****@'));
  await mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
  });
  console.log('Connected to MongoDB');

  // Cancel any running test runs to prevent blocking
  const cancelled = await QATestRun.updateMany(
    { status: { $in: ['pending', 'in-progress'] } },
    { $set: { status: 'cancelled', completedAt: new Date() } }
  );
  if (cancelled.modifiedCount > 0) {
    console.log(`Cancelled ${cancelled.modifiedCount} active test runs.`);
  }

  // Get a system or admin user
  const User = require('../models/User');
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.findOne({}) || { _id: new mongoose.Types.ObjectId() };
  }

  console.log('Using initiator user ID:', adminUser._id);

  // Initialize service
  const qaService = new QATestingService(null, adminUser._id, {
    testAgentName: 'QA CLI Runner',
    testRole: 'admin',
    permissions: []
  });

  console.log('Starting QA testing run...');
  const result = await qaService.startTesting();
  console.log('QA Scan Started. Run ID:', result.testRunId);

  // Poll progress until complete or failed
  let done = false;
  while (!done) {
    const runDoc = await QATestRun.findById(result.testRunId);
    if (!runDoc) {
      console.error('Test run document missing!');
      break;
    }
    const currentProg = runDoc.progress?.current || 0;
    console.log(`Progress: ${currentProg}% (${runDoc.pagesTestedCount} / ${runDoc.testCases.length} tested). Status: ${runDoc.status}`);
    
    if (['completed', 'error', 'cancelled'].includes(runDoc.status)) {
      done = true;
      console.log('Scan finished with status:', runDoc.status);
      if (runDoc.status === 'error') {
        console.error('Error details:', runDoc.errorDetails);
      }
      
      const failedCases = runDoc.testCases.filter(tc => tc.status === 'failed');
      console.log('\n--- Failed Test Cases ---');
      console.log(`Total Failed: ${failedCases.length}`);
      failedCases.forEach((tc, idx) => {
        console.log(`\n${idx + 1}. [${tc.severity.toUpperCase()}] ${tc.name}`);
        console.log(`   Category: ${tc.category}`);
        console.log(`   Error: ${tc.error}`);
        console.log(`   Description: ${tc.description}`);
      });
      console.log('\n-------------------------');
      
      const passedCases = runDoc.testCases.filter(tc => tc.status === 'passed');
      console.log(`Total Passed: ${passedCases.length}`);
      
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Done.');
}

run().catch(err => {
  console.error('Crash in runner:', err);
  mongoose.disconnect();
  process.exit(1);
});
