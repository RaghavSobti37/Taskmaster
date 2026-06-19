/**
 * Import Instagram analytics from TSC mastersheet CSV exports.
 *
 * Usage:
 *   node server/scripts/importArtistAnalyticsFromSheet.js path/to/file.csv [more.csv...]
 *   node server/scripts/importArtistAnalyticsFromSheet.js --prod path/to/file.csv
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const mongoose = require('mongoose');
const { importArtistAnalyticsFromFile } = require('../domains/artists/services/artistAnalyticsSheetImportService');

async function main() {
  const useProd = process.argv.includes('--prod');
  const fileArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!fileArgs.length) {
    throw new Error('Pass one or more analytics CSV file paths');
  }

  const uri = useProd
    ? (process.env.MONGODB_URI_PROD || process.env.MONGO_URI_PROD)
    : (process.env.MONGODB_URI || process.env.MONGO_URI);
  if (!uri) {
    throw new Error(useProd ? 'MONGODB_URI_PROD not set' : 'MONGODB_URI not set');
  }

  await mongoose.connect(uri);

  for (const filePath of fileArgs) {
    const resolved = path.resolve(filePath);
    const result = await importArtistAnalyticsFromFile({
      filePath: resolved,
      filename: path.basename(resolved),
      createMissing: true,
    });
    console.log(
      `✓ ${result.artistName} (${result.template}) — ${result.periodLabel || 'latest'}: `
      + `${result.followers.toLocaleString()} followers, ${result.engagementRate}% engagement`,
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
