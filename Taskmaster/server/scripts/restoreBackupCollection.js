#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { readBackupCollection, getSourceUri } = require('../services/databaseBackupService');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = { dryRun: false, exportPath: null };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--date') parsed.date = args[++i];
    else if (arg === '--collection') parsed.collection = args[++i];
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--export') parsed.exportPath = args[++i];
  }

  return parsed;
};

const restoreToProduction = async (collectionName, documents) => {
  const sourceUri = getSourceUri();
  const connection = await mongoose.createConnection(sourceUri, {
    serverSelectionTimeoutMS: 30000,
  }).asPromise();

  try {
    const target = connection.db.collection(collectionName);
    if (documents.length) {
      await target.insertMany(documents, { ordered: false });
    }
    return documents.length;
  } finally {
    await connection.close();
  }
};

const main = async () => {
  const { date, collection, dryRun, exportPath } = parseArgs();

  if (!date || !collection) {
    console.error('Usage: node server/scripts/restoreBackupCollection.js --date <backup-date-key> --collection <name> [--dry-run] [--export ./out.json]');
    process.exit(1);
  }

  try {
    const documents = await readBackupCollection(date, collection);
    console.log(`Loaded ${documents.length} documents from backup ${date}/${collection}`);

    if (exportPath) {
      fs.writeFileSync(exportPath, JSON.stringify(documents, null, 2), 'utf8');
      console.log(`Exported to ${exportPath}`);
    }

    if (dryRun) {
      console.log('Dry run — no writes performed.');
      if (documents[0]) {
        console.log('Sample document keys:', Object.keys(documents[0]).join(', '));
      }
      process.exit(0);
    }

    if (exportPath) {
      process.exit(0);
    }

    const inserted = await restoreToProduction(collection, documents);
    console.log(`Restored ${inserted} documents into production collection "${collection}".`);
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
};

main();
