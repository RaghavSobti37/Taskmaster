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
 *   node server/scripts/reparseFinanceOcr.js --prod --missing-date
 *   node server/scripts/reparseFinanceOcr.js --prod --missing-date --reuse-text
 *   node server/scripts/reparseFinanceOcr.js --prod --dates-only
 *   node server/scripts/reparseFinanceOcr.js --prod --missing-date --filename-only
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const axios = require('axios');
const FinanceDocument = require('../models/FinanceDocument');
const { parseDocument, parseMetadataFromText } = require('../utils/documentParser');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RUN_LOCAL = args.includes('--local') || args.includes('--all');
const RUN_PROD = args.includes('--prod') || args.includes('--all');
const MISSING_DATE_ONLY = args.includes('--missing-date');
const REUSE_TEXT = args.includes('--reuse-text');
const DATES_ONLY = args.includes('--dates-only');
const FILENAME_ONLY = args.includes('--filename-only');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null;

const BYPASS = { bypassTenant: true };

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
  if (MISSING_DATE_ONLY) {
    query.$or = [
      { 'metadata.date': { $exists: false } },
      { 'metadata.date': null },
    ];
  }

  let cursor = FinanceDocument.find(query).setOptions(BYPASS).sort({ createdAt: 1 }).cursor();
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let datesFilled = 0;

  for await (const doc of cursor) {
    if (LIMIT && processed >= LIMIT) break;
    processed += 1;

    const oldDate = doc.metadata?.date;
    const oldAmount = Number(doc.metadata?.amount) || 0;
    const title = doc.title || doc.fileName || doc._id.toString();

    try {
      let parsed;
      const cachedText = String(doc.extractedText || '').trim();
      if (FILENAME_ONLY) {
        parsed = {
          extractedText: cachedText,
          metadata: parseMetadataFromText('', {
            title: doc.title,
            fileName: doc.fileName,
            createdAt: doc.createdAt,
          }),
        };
      } else if (REUSE_TEXT && cachedText.length >= 10) {
        parsed = {
          extractedText: cachedText,
          metadata: parseMetadataFromText(cachedText, {
            title: doc.title,
            fileName: doc.fileName,
            createdAt: doc.createdAt,
          }),
        };
      } else {
        const response = await axios.get(doc.fileUrl, {
          responseType: 'arraybuffer',
          timeout: 120000,
        });
        const buffer = Buffer.from(response.data);
        const mimeType = resolveMimeType(doc);
        parsed = await parseDocument(buffer, mimeType);
        if (!parsed.metadata?.date) {
          const fromName = parseMetadataFromText(parsed.extractedText || '', {
            title: doc.title,
            fileName: doc.fileName,
            createdAt: doc.createdAt,
          }).date;
          if (fromName) parsed.metadata.date = fromName;
        }
      }

      const parsedAmount = Number(parsed.metadata?.amount) || 0;
      const parsedMeta = parsed.metadata || {};
      const baseMeta = doc.metadata?.toObject?.() || doc.metadata || {};

      const nextMetadata = DATES_ONLY
        ? {
          ...baseMeta,
          date: parsedMeta.date ?? baseMeta.date ?? null,
        }
        : {
          ...baseMeta,
          amount: parsedAmount > 0 ? parsedAmount : (Number(baseMeta.amount) || 0),
          currency: parsedMeta.currency || baseMeta.currency || 'INR',
          vendor: parsedMeta.vendor || baseMeta.vendor || '',
          date: parsedMeta.date ?? baseMeta.date ?? null,
          tax: parsedMeta.tax > 0 ? parsedMeta.tax : (Number(baseMeta.tax) || 0),
          detectedCategory: parsedMeta.detectedCategory || baseMeta.detectedCategory || doc.category || 'other',
        };

      const dateChanged = formatDateKey(oldDate) !== formatDateKey(nextMetadata.date);
      const dateNewlyFilled = !oldDate && nextMetadata.date;
      const vendorChanged = (doc.metadata?.vendor || '') !== (nextMetadata.vendor || '');
      const amountChanged = oldAmount !== (Number(nextMetadata.amount) || 0);
      const categoryChanged = !DATES_ONLY && parsed.metadata?.detectedCategory
        && parsed.metadata.detectedCategory !== 'other'
        && parsed.metadata.detectedCategory !== (doc.category || 'other');

      if (DRY_RUN) {
        console.log(`~ ${title}`);
        console.log(`  amount: ${oldAmount} -> ${nextMetadata.amount || 0}${amountChanged ? ' *' : ''}`);
        console.log(`  date: ${formatDateKey(oldDate)} -> ${formatDateKey(nextMetadata.date)}${dateChanged ? ' *' : ''}`);
        if (vendorChanged) console.log(`  vendor: "${doc.metadata?.vendor || ''}" -> "${nextMetadata.vendor || ''}"`);
        if (amountChanged || dateChanged || vendorChanged || categoryChanged) updated += 1;
        else skipped += 1;
        if (dateNewlyFilled) datesFilled += 1;
        continue;
      }

      if (!DATES_ONLY) {
        doc.extractedText = parsed.extractedText || doc.extractedText || '';
        if (parsed.metadata?.detectedCategory && parsed.metadata.detectedCategory !== 'other') {
          doc.category = parsed.metadata.detectedCategory;
        }
      }
      doc.metadata = nextMetadata;
      await doc.save();

      if (amountChanged || dateChanged || vendorChanged || categoryChanged) {
        updated += 1;
        console.log(`✓ ${title}`);
        if (amountChanged) {
          console.log(`  amount: ${oldAmount} -> ${nextMetadata.amount || 0}`);
        }
        if (dateChanged) {
          console.log(`  date: ${formatDateKey(oldDate)} -> ${formatDateKey(nextMetadata.date)}`);
        }
        if (dateNewlyFilled) datesFilled += 1;
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
  console.log(`  dates filled: ${datesFilled}`);
  console.log(`  unchanged: ${skipped}`);
  console.log(`  failed:    ${failed}`);

  return { processed, updated, skipped, failed, datesFilled };
}

async function run() {
  if (!RUN_LOCAL && !RUN_PROD) {
    console.error('Pass --local, --prod, or --all');
    process.exit(1);
  }

  if (DRY_RUN) console.log('DRY RUN — no database writes');
  if (MISSING_DATE_ONLY) console.log('Filter: documents missing metadata.date');
  if (REUSE_TEXT) console.log('Mode: reuse cached extractedText when available');
  if (DATES_ONLY) console.log('Mode: update payment date only');
  if (FILENAME_ONLY) console.log('Mode: filename/title date inference only (no download)');

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
      datesFilled: acc.datesFilled + (row.datesFilled || 0),
    }),
    { processed: 0, updated: 0, skipped: 0, failed: 0, datesFilled: 0 }
  );

  console.log('\n=== TOTAL ===');
  console.log(`  processed: ${totals.processed}`);
  console.log(`  updated:   ${totals.updated}`);
  console.log(`  dates filled: ${totals.datesFilled}`);
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
