require('dotenv').config();
const mongoose = require('mongoose');
const { createOAuth2Client } = require('./utils/googleAuth');
const GamificationService = require('./services/gamificationService');
const eventDispatcher = require('./services/eventDispatcher');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');

async function runTests() {
  console.log('--- STARTING SYSTEM TESTS ---');
  let results = {
    mongo: 'PENDING',
    gcp: 'PENDING',
    gamification: 'PENDING'
  };

  try {
    // 1. Test Mongo Connection
    console.log('1. Testing MongoDB Connection...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
    results.mongo = 'PASS';

    // 2. Test GCP Google Auth
    console.log('2. Testing Google Cloud / OAuth Setup...');
    try {
      const oauth2Client = createOAuth2Client();
      if (oauth2Client) {
        console.log('✅ Google OAuth Client Initialized');
        results.gcp = 'PASS';
      }
    } catch (e) {
      console.error('❌ Google Auth Failed:', e.message);
      results.gcp = 'FAIL';
    }

    // 3. Test Gamification (XP & Missions)
    console.log('3. Testing Gamification Worker (TASK_COMPLETED)...');
    try {
      // Require background queue to start Redis connection
      require('./services/backgroundQueue');

      // Wait 3 seconds for BullMQ / Redis to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      const { initializeWorker } = require('./services/gamificationWorker');
      initializeWorker();

      // Create dummy user
      let user = await User.findOne({ email: 'test_gamification@example.com' });
      if (!user) {
        user = await User.create({
          name: 'QA Test User',
          email: 'test_gamification@example.com',
          password: 'password123',
          exp: 0,
          level: 1,
          tenantId: new mongoose.Types.ObjectId()
        });
      }
      
      const initialExp = user.exp || 0;

      // Mock task
      const mockTask = {
        _id: new mongoose.Types.ObjectId(),
        title: 'QA Test Task - Gamification',
        priority: 'high',
        plannedHours: 2,
        createdBy: user._id,
        assignees: [user._id]
      };

      // Wait 2 seconds for BullMQ / Redis to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Listen for updates (Wait for 2 seconds to allow worker to process)
      eventDispatcher.emit('TASK_COMPLETED', {
        userId: user._id,
        tenantId: user.tenantId,
        task: mockTask
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedUser = await User.findById(user._id);
      
      if (updatedUser.exp > initialExp) {
        console.log(`✅ Gamification XP Awarded (Initial: ${initialExp} -> New: ${updatedUser.exp})`);
        results.gamification = 'PASS';
      } else {
        console.error('❌ Gamification XP Not Awarded');
        results.gamification = 'FAIL';
      }

      // Cleanup
      await User.deleteOne({ _id: user._id });

    } catch (e) {
      console.error('❌ Gamification Test Failed:', e.message);
      results.gamification = 'FAIL';
    }

  } catch (err) {
    console.error('❌ Global Test Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('--- TEST RESULTS ---');
    console.table(results);
    process.exit(0);
  }
}

runTests();
