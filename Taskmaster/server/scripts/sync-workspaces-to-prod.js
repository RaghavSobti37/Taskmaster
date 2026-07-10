#!/usr/bin/env node

/**
 * Sync Workspace Data from Local to Production
 * - Copies all workspace documents from local to production
 * - Preserves all data as-is
 * - Uses upsert to avoid duplicates
 * 
 * Usage: node server/scripts/sync-workspaces-to-prod.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

const runSync = async () => {
  let localConnection, prodConnection;

  try {
    const localUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
    const prodUri = process.env.MONGODB_URI_PROD;

    if (!prodUri) {
      console.error('❌ MONGODB_URI_PROD not set in .env');
      process.exit(1);
    }

    console.log('🔄 Connecting to local database...');
    localConnection = await mongoose.createConnection(localUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to local database');

    console.log('🔄 Connecting to production database...');
    prodConnection = await mongoose.createConnection(prodUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to production database');

    // Get local workspaces
    console.log('\n📋 Fetching local workspaces...');
    const LocalWorkspace = localConnection.model('Workspace', require('../models/Workspace').schema);
    const localWorkspaces = await LocalWorkspace.find().lean();
    console.log(`✅ Found ${localWorkspaces.length} workspaces in local database`);

    if (localWorkspaces.length === 0) {
      console.log('ℹ️  No workspaces to sync');
      process.exit(0);
    }

    // Display workspaces
    console.log('\n📊 Local workspaces:');
    localWorkspaces.forEach(ws => {
      console.log(`  - ${ws.name} (order: ${ws.order}, color: ${ws.color})`);
    });

    // Upsert to production
    console.log('\n📋 Syncing to production...');
    const ProdWorkspace = prodConnection.model('Workspace', require('../models/Workspace').schema);
    
    let syncedCount = 0;
    for (const ws of localWorkspaces) {
      await ProdWorkspace.updateOne(
        { name: ws.name },
        { $set: ws },
        { upsert: true }
      );
      syncedCount++;
      console.log(`  ✓ ${ws.name}`);
    }
    console.log(`✅ Synced ${syncedCount} workspaces to production`);

    // Verify
    console.log('\n📋 Verifying production workspaces...');
    const prodWorkspaces = await ProdWorkspace.find().sort({ order: 1 }).lean();
    console.log(`✅ Production now has ${prodWorkspaces.length} workspaces:`);
    prodWorkspaces.forEach(ws => {
      console.log(`  - ${ws.name} (order: ${ws.order}, color: ${ws.color})`);
    });

    console.log('\n🎉 Workspace data sync completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    logger.error('sync-workspaces-to-prod', 'Sync failed', { error: error.message });
    process.exit(1);
  } finally {
    if (localConnection) await localConnection.close();
    if (prodConnection) await prodConnection.close();
  }
};

// Run sync
runSync();
