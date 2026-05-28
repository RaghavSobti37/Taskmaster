#!/usr/bin/env node

/**
 * Production Migration Script
 * - Adds `order` field to workspaces collection
 * - Deletes SOCIAL MEDIA workspace
 * - Migrates projects from SOCIAL MEDIA to GENERAL
 * 
 * Usage: node server/scripts/migrate-production.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const logger = require('../utils/logger');

const runMigration = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster';
  
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to database');

    // Step 1: Add `order` field to all workspaces
    console.log('\n📋 Step 1: Adding `order` field to workspaces...');
    const workspaces = await Workspace.find();
    
    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      if (ws.order === undefined || ws.order === null) {
        ws.order = i;
        await ws.save();
        console.log(`  ✓ ${ws.name}: order = ${i}`);
      }
    }
    console.log(`✅ Updated ${workspaces.length} workspaces`);

    // Step 2: Migrate projects from SOCIAL MEDIA to GENERAL
    console.log('\n📋 Step 2: Migrating SOCIAL MEDIA projects to GENERAL...');
    const socialMediaProjects = await Project.find({ workspace: 'SOCIAL MEDIA' });
    
    if (socialMediaProjects.length > 0) {
      await Project.updateMany(
        { workspace: 'SOCIAL MEDIA' },
        { workspace: 'GENERAL' }
      );
      console.log(`✅ Migrated ${socialMediaProjects.length} projects to GENERAL`);
      socialMediaProjects.forEach(p => {
        console.log(`  ✓ ${p.name}: SOCIAL MEDIA → GENERAL`);
      });
    } else {
      console.log('ℹ️  No projects in SOCIAL MEDIA workspace');
    }

    // Step 3: Delete SOCIAL MEDIA workspace
    console.log('\n📋 Step 3: Deleting SOCIAL MEDIA workspace...');
    const deleted = await Workspace.deleteOne({ name: 'SOCIAL MEDIA' });
    
    if (deleted.deletedCount > 0) {
      console.log('✅ SOCIAL MEDIA workspace deleted');
    } else {
      console.log('ℹ️  SOCIAL MEDIA workspace not found (already deleted)');
    }

    // Step 4: Verify new structure
    console.log('\n📋 Step 4: Final verification...');
    const finalWorkspaces = await Workspace.find().sort({ order: 1 });
    console.log('✅ Current workspaces (in order):');
    finalWorkspaces.forEach(ws => {
      console.log(`  ${ws.order + 1}. ${ws.name} (color: ${ws.color})`);
    });

    const projectCount = await Project.countDocuments();
    const socialMediaCount = await Project.countDocuments({ workspace: 'SOCIAL MEDIA' });
    
    console.log(`\n✅ Total projects: ${projectCount}`);
    console.log(`✅ Projects in SOCIAL MEDIA: ${socialMediaCount} (should be 0)`);

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    logger.error('migrate-production', 'Migration failed', { error: error.message });
    process.exit(1);
  }
};

// Run migration
runMigration();
