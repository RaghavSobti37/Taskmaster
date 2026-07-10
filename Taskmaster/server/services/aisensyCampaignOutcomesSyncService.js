const fs = require('fs');
const path = require('path');
const os = require('os');
const { importAisensyCampaignCsv } = require('./aisensyCampaignImportService');
const {
  inferStatusFromFilename,
  inferCampaignNameFromFilename,
} = require('./aisensyCampaignNameUtils');

const EXPORT_FILE_RE = /(audience|failed|delivered|read|clicked|replied)/i;

function resolveAisensyExportDirs(extraDir = '') {
  const dirs = new Set();
  const fromEnv = (process.env.AISENSY_EXPORT_DIR || '').trim();
  if (fromEnv) dirs.add(path.resolve(fromEnv));
  if (extraDir) dirs.add(path.resolve(extraDir));
  dirs.add(path.join(process.cwd(), 'reports', 'aisensy-exports'));
  dirs.add(path.join(os.homedir(), 'Downloads'));
  return [...dirs].filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}

function discoverAisensyExportFiles(dirs = []) {
  const files = new Map();
  for (const dir of dirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!/\.csv$/i.test(entry)) continue;
      if (!EXPORT_FILE_RE.test(entry)) continue;
      const fullPath = path.join(dir, entry);
      try {
        if (!fs.statSync(fullPath).isFile()) continue;
      } catch {
        continue;
      }
      files.set(fullPath.toLowerCase(), fullPath);
    }
  }
  return [...files.values()].sort();
}

async function importAisensyExportsFromDirectories({
  dirs = [],
  dryRun = false,
} = {}) {
  const scanDirs = dirs.length ? dirs.map((d) => path.resolve(d)) : resolveAisensyExportDirs();
  const files = discoverAisensyExportFiles(scanDirs);
  const stats = {
    dryRun,
    scanDirs,
    filesFound: files.length,
    files: [],
    imported: 0,
    rowsRead: 0,
    errors: 0,
  };

  for (const filePath of files) {
    const fileStats = await importAisensyCampaignCsv({
      filePath,
      campaignName: inferCampaignNameFromFilename(filePath),
      defaultStatus: inferStatusFromFilename(filePath),
      sourceFilename: filePath,
      dryRun,
    });
    stats.files.push({ filePath, ...fileStats });
    stats.imported += fileStats.imported || 0;
    stats.rowsRead += fileStats.rowsRead || 0;
    stats.errors += fileStats.errors || 0;
  }

  return stats;
}

module.exports = {
  EXPORT_FILE_RE,
  resolveAisensyExportDirs,
  discoverAisensyExportFiles,
  importAisensyExportsFromDirectories,
};
