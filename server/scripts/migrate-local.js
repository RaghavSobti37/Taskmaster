#!/usr/bin/env node

/**
 * Local Migration Script (for development/testing)
 * - Adds `order` field to workspaces collection
 * - Does NOT delete SOCIAL MEDIA (for local testing)
 * 
 * Usage: node server/scripts/migrate-local.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

const runMigration = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
  
  try {
    console.log('🔄 Connecting to local database...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to database');

    // Add `order` field to all workspaces
    console.log('\n📋 Adding `order` field to workspaces...');
    const workspaces = await Workspace.find().sort({ name: 1 });
    
    const order = ['TSC ACADEMY', 'TSC ARTISTS', 'TSC FILMS', 'TSC TECH', 'GENERAL', 'SOCIAL MEDIA'];
    
    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      const orderIndex = order.indexOf(ws.name);
      ws.order = orderIndex >= 0 ? orderIndex : i;
      await ws.save();
      console.log(`  ✓ ${ws.name}: order = ${ws.order}`);
    }
    console.log(`✅ Updated ${workspaces.length} workspaces`);

    // Verify
    console.log('\n📋 Final verification:');
    const finalWorkspaces = await Workspace.find().sort({ order: 1 });
    console.log('✅ Current workspaces (in order):');
    finalWorkspaces.forEach(ws => {
      console.log(`  ${ws.order + 1}. ${ws.name} (color: ${ws.color})`);
    });

    console.log('\n🎉 Local migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    logger.error('migrate-local', 'Migration failed', { error: error.message });
    process.exit(1);
  }
};

// Run migration
runMigration();
