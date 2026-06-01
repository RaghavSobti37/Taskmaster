#!/usr/bin/env node

/**
 * Sync local finance data to production (as-is).
 * - Copies `financedocuments` collection from local DB to production DB
 * - Preserves documents and folders exactly (including _id and folder links)
 * - Replaces production collection content with local content
 *
 * Usage: node server/scripts/syncFinanceToProd.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const LOCAL_DB_NAME = process.env.MONGODB_DB_LOCAL || 'coreknot_local';
const PROD_DB_NAME = process.env.MONGODB_DB_PROD || 'coreknot_production';
const COLLECTION = 'financedocuments';

const BATCH_SIZE = 500;

async function run() {
  const localUri = process.env.MONGODB_URI;
  const prodUri = process.env.MONGODB_URI_PROD;

  if (!localUri || !prodUri) {
    console.error('❌ Missing MONGODB_URI or MONGODB_URI_PROD in .env');
    process.exit(1);
  }

  const localClient = new MongoClient(localUri);
  const prodClient = new MongoClient(prodUri);

  try {
    console.log('🔄 Connecting to local database...');
    await localClient.connect();
    console.log('✅ Connected to local database');

    console.log('🔄 Connecting to production database...');
    await prodClient.connect();
    console.log('✅ Connected to production database');

    const localDb = localClient.db(LOCAL_DB_NAME);
    const prodDb = prodClient.db(PROD_DB_NAME);

    const localCol = localDb.collection(COLLECTION);
    const prodCol = prodDb.collection(COLLECTION);

    const localCount = await localCol.countDocuments();
    console.log(`\n📋 Local finance docs found: ${localCount}`);

    console.log('\n📋 Clearing production finance collection...');
    const delRes = await prodCol.deleteMany({});
    console.log(`✅ Deleted ${delRes.deletedCount} production finance docs`);

    if (localCount === 0) {
      console.log('ℹ️ Local finance collection is empty. Production now cleared as requested.');
      process.exit(0);
    }

    console.log('\n📋 Copying local finance docs to production...');
    const cursor = localCol.find({});
    let batch = [];
    let inserted = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      batch.push(doc);

      if (batch.length >= BATCH_SIZE) {
        await prodCol.insertMany(batch, { ordered: false });
        inserted += batch.length;
        console.log(`  ✓ inserted ${inserted}/${localCount}`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await prodCol.insertMany(batch, { ordered: false });
      inserted += batch.length;
      console.log(`  ✓ inserted ${inserted}/${localCount}`);
    }

    const prodCount = await prodCol.countDocuments();
    console.log('\n📋 Verification...');
    console.log(`✅ Local count: ${localCount}`);
    console.log(`✅ Production count: ${prodCount}`);

    if (prodCount !== localCount) {
      console.error('❌ Count mismatch after sync');
      process.exit(1);
    }

    console.log('\n🎉 Finance sync completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Finance sync failed:', err.message);
    process.exit(1);
  } finally {
    await localClient.close();
    await prodClient.close();
  }
}

run();
