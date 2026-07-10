#!/usr/bin/env node

/**
 * Production Migration Script
 * - Syncs workspace structure from LOCAL DB to PRODUCTION DB
 * - No workspace rename/delete/move logic
 *
 * Usage: node server/scripts/migrate-production.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const logger = require('../utils/logger');

const runMigration = async () => {
  let localConnection;
  let prodConnection;

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

    const workspaceSchema = require('../models/Workspace').schema;
    const LocalWorkspace = localConnection.model('Workspace', workspaceSchema);
    const ProdWorkspace = prodConnection.model('Workspace', workspaceSchema);

    console.log('\n📋 Fetching local workspaces...');
    const localWorkspaces = await LocalWorkspace.find().lean();
    console.log(`✅ Found ${localWorkspaces.length} local workspaces`);

    if (localWorkspaces.length === 0) {
      console.log('ℹ️ No local workspaces found. Nothing to migrate.');
      process.exit(0);
    }

    console.log('\n📋 Syncing structure to production...');
    let syncedCount = 0;
    const localWorkspaceNames = new Set(localWorkspaces.map((ws) => ws.name));
    for (const ws of localWorkspaces) {
      const { _id, createdAt, updatedAt, ...syncData } = ws;
      await ProdWorkspace.updateOne(
        { name: ws.name },
        { $set: syncData },
        { upsert: true }
      );
      syncedCount++;
      console.log(`  ✓ ${ws.name} (order: ${ws.order}, color: ${ws.color})`);
    }
    console.log(`✅ Synced ${syncedCount} workspaces`);

    console.log('\n📋 Removing production-only workspaces...');
    const prodBeforeDelete = await ProdWorkspace.find({}, 'name').lean();
    const toDelete = prodBeforeDelete
      .map((ws) => ws.name)
      .filter((name) => !localWorkspaceNames.has(name));

    if (toDelete.length > 0) {
      const deleteResult = await ProdWorkspace.deleteMany({ name: { $in: toDelete } });
      console.log(`✅ Removed ${deleteResult.deletedCount} workspace(s): ${toDelete.join(', ')}`);
    } else {
      console.log('ℹ️ No extra production workspaces to remove');
    }

    console.log('\n📋 Verifying production structure...');
    const prodWorkspaces = await ProdWorkspace.find().sort({ order: 1 }).lean();
    prodWorkspaces.forEach((ws, idx) => {
      console.log(`  ${idx + 1}. ${ws.name} (order: ${ws.order}, color: ${ws.color})`);
    });

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    logger.error('migrate-production', 'Migration failed', { error: error.message });
    process.exit(1);
  } finally {
    if (localConnection) await localConnection.close();
    if (prodConnection) await prodConnection.close();
  }
};

runMigration();
