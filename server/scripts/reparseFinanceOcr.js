#!/usr/bin/env node

/**
 * Re-run OCR/parser on finance documents and refresh extracted metadata.
 *
 * Usage:
 *   node server/scripts/reparseFinanceOcr.js --local
 *   node server/scripts/reparseFinanceOcr.js --prod
 *   node server/scripts/reparseFinanceOcr.js --all
 *   node server/scripts/reparseFinanceOcr.js --local --dry-run
 *   node server/scripts/reparseFinanceOcr.js --all --limit 10
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const axios = require('axios');
const FinanceDocument = require('../models/FinanceDocument');
const { parseDocument } = require('../utils/documentParser');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RUN_LOCAL = args.includes('--local') || args.includes('--all');
const RUN_PROD = args.includes('--prod') || args.includes('--all');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDateKey = (value) => {
  if (!value) return '—';
  return new Date(value).toISOString().slice(0, 10);
};

const resolveMimeType = (doc) => {
  if (doc.fileType) return doc.fileType;
  const ext = (doc.fileName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return ext || 'application/pdf';
};

async function reparseDatabase(label, uri) {
  console.log(`\n=== ${label.toUpperCase()} ===`);
  await mongoose.connect(uri);

  const query = {
    isFolder: { $ne: true },
    fileUrl: { $exists: true, $nin: ['', 'folder://placeholder'] },
  };

  let cursor = FinanceDocument.find(query).sort({ createdAt: 1 }).cursor();
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for await (const doc of cursor) {
    if (LIMIT && processed >= LIMIT) break;
    processed += 1;

    const oldDate = doc.metadata?.date;
    const title = doc.title || doc.fileName || doc._id.toString();

    try {
      const response = await axios.get(doc.fileUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      const buffer = Buffer.from(response.data);
      const mimeType = resolveMimeType(doc);
      const parsed = await parseDocument(buffer, mimeType);
      const nextMetadata = {
        ...(doc.metadata?.toObject?.() || doc.metadata || {}),
        amount: parsed.metadata?.amount ?? doc.metadata?.amount ?? 0,
        currency: parsed.metadata?.currency || doc.metadata?.currency || 'INR',
        vendor: parsed.metadata?.vendor || doc.metadata?.vendor || '',
        date: parsed.metadata?.date ?? doc.metadata?.date ?? null,
        tax: parsed.metadata?.tax ?? doc.metadata?.tax ?? 0,
        detectedCategory: parsed.metadata?.detectedCategory || doc.metadata?.detectedCategory || doc.category || 'other',
      };

      const dateChanged = formatDateKey(oldDate) !== formatDateKey(nextMetadata.date);
      const vendorChanged = (doc.metadata?.vendor || '') !== (nextMetadata.vendor || '');

      if (DRY_RUN) {
        console.log(`~ ${title}`);
        console.log(`  date: ${formatDateKey(oldDate)} -> ${formatDateKey(nextMetadata.date)}${dateChanged ? ' *' : ''}`);
        if (vendorChanged) console.log(`  vendor: "${doc.metadata?.vendor || ''}" -> "${nextMetadata.vendor || ''}"`);
        if (dateChanged || vendorChanged) updated += 1;
        else skipped += 1;
        continue;
      }

      doc.extractedText = parsed.extractedText || doc.extractedText || '';
      doc.metadata = nextMetadata;
      if (parsed.metadata?.detectedCategory && parsed.metadata.detectedCategory !== 'other') {
        doc.category = parsed.metadata.detectedCategory;
      }
      await doc.save();

      if (dateChanged || vendorChanged) {
        updated += 1;
        console.log(`✓ ${title}`);
        if (dateChanged) {
          console.log(`  date: ${formatDateKey(oldDate)} -> ${formatDateKey(nextMetadata.date)}`);
        }
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`✗ ${title}: ${error.message}`);
    }

    await sleep(250);
  }

  await mongoose.disconnect();

  console.log(`\n${label} summary:`);
  console.log(`  processed: ${processed}`);
  console.log(`  updated:   ${updated}`);
  console.log(`  unchanged: ${skipped}`);
  console.log(`  failed:    ${failed}`);

  return { processed, updated, skipped, failed };
}

async function run() {
  if (!RUN_LOCAL && !RUN_PROD) {
    console.error('Pass --local, --prod, or --all');
    process.exit(1);
  }

  if (DRY_RUN) console.log('DRY RUN — no database writes');

  const results = [];

  if (RUN_LOCAL) {
    if (!process.env.MONGODB_URI) {
      console.error('Missing MONGODB_URI');
      process.exit(1);
    }
    results.push(await reparseDatabase('local', process.env.MONGODB_URI));
  }

  if (RUN_PROD) {
    if (!process.env.MONGODB_URI_PROD) {
      console.error('Missing MONGODB_URI_PROD');
      process.exit(1);
    }
    results.push(await reparseDatabase('production', process.env.MONGODB_URI_PROD));
  }

  const totals = results.reduce(
    (acc, row) => ({
      processed: acc.processed + row.processed,
      updated: acc.updated + row.updated,
      skipped: acc.skipped + row.skipped,
      failed: acc.failed + row.failed,
    }),
    { processed: 0, updated: 0, skipped: 0, failed: 0 }
  );

  console.log('\n=== TOTAL ===');
  console.log(`  processed: ${totals.processed}`);
  console.log(`  updated:   ${totals.updated}`);
  console.log(`  unchanged: ${totals.skipped}`);
  console.log(`  failed:    ${totals.failed}`);
}

run().catch(async (error) => {
  console.error('Reparse failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
