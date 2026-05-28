/**
 * Import finance documents from Basecamp Download folders into MongoDB + UploadThing.
 * Preserves disk layout: project root files + one level of subfolders as finance folders.
 *
 * Usage:
 *   node server/scripts/importInvoices.js              # incremental (skip existing)
 *   node server/scripts/importInvoices.js --fresh      # purge each project then re-import
 *   node server/scripts/importInvoices.js --dry-run    # scan only
 *   node server/scripts/importInvoices.js --skip-ocr   # faster uploads (no parsing)
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { UTApi, UTFile } = require('uploadthing/server');
const { parseDocument } = require('../utils/documentParser');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const User = require('../models/User');
const { formatProjectName } = require('../utils/formatProjectName');
const { syncFolderPlacementFromDisk } = require('../utils/financeDiskSync');

const DRY_RUN = process.argv.includes('--dry-run');
const FRESH = process.argv.includes('--fresh');
const SKIP_OCR = process.argv.includes('--skip-ocr');

/** Attachments folder intentionally excluded */
const SOURCE_ROOTS = [
  {
    label: 'Havells mYOUsic',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download (4)\\Havells mYOUsic',
    projectName: 'Havells mYOUsic',
  },
  {
    label: 'TSC Academy',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download\\TSC Academy - Invoices',
    projectName: 'TSC Academy',
  },
  {
    label: 'Himalayan Harmonies',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download (3)\\Himalayan Harmonies',
    projectName: 'Himalayan Harmonies',
  },
  {
    label: 'Dattadham',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download (5)\\Dattadham',
    projectName: 'Dattadham',
  },
];

const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls', '.doc', '.docx'];

let utapi;
try {
  const tokenData = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN || '', 'base64').toString());
  utapi = new UTApi({ apiKey: tokenData.apiKey });
} catch {
  utapi = new UTApi({ apiKey: process.env.UPLOADTHING_SECRET });
}

function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] || 'application/octet-stream';
}

function scanSourceRoot(rootDir) {
  const folders = [];
  const rootFiles = [];

  if (!fs.existsSync(rootDir)) {
    console.warn(`Path not found: ${rootDir}`);
    return { folders, rootFiles, missing: true };
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const files = [];
      const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isFile()) continue;
        const ext = path.extname(sub.name).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) continue;
        const fp = path.join(fullPath, sub.name);
        files.push({ name: sub.name, path: fp, size: fs.statSync(fp).size });
      }
      folders.push({ folderName: entry.name, files });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) continue;
      rootFiles.push({ name: entry.name, path: fullPath, size: fs.statSync(fullPath).size });
    }
  }

  return { folders, rootFiles, missing: false };
}

async function findProjectByName(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Project.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
}

async function getOrCreateProject(name, adminUser, tenantId) {
  const displayName = formatProjectName(name);
  let project = await findProjectByName(displayName);
  if (!project) {
    console.log(`Creating project: ${displayName}`);
    project = new Project({
      name: displayName,
      description: `Finance documents for ${displayName}`,
      outletId: adminUser.currentOutletId || 'main',
      owner: adminUser._id,
      members: [adminUser._id],
      status: 'active',
      tenantId,
    });
    if (!DRY_RUN) await project.save();
  }
  return project;
}

async function purgeProjectFinance(projectId) {
  const docs = await FinanceDocument.find({ project: projectId });
  console.log(`Purging ${docs.length} existing records for project ${projectId}`);

  if (DRY_RUN) return;

  for (const doc of docs) {
    if (!doc.isFolder && doc.fileKey) {
      try {
        await utapi.deleteFiles(doc.fileKey);
      } catch (e) {
        console.warn(`UT delete skip: ${doc.fileName}`, e.message);
      }
    }
  }
  await FinanceDocument.deleteMany({ project: projectId });
}

async function getOrCreateFolder(projectId, folderName, adminUser, tenantId) {
  let folder = await FinanceDocument.findOne({
    isFolder: true,
    project: projectId,
    folderName,
    parentFolderId: null,
  });

  if (!folder) {
    folder = new FinanceDocument({
      isFolder: true,
      folderName,
      title: folderName,
      project: projectId,
      uploadedBy: adminUser._id,
      category: 'other',
      tenantId,
    });
    if (!DRY_RUN) await folder.save();
    console.log(`  Folder created: ${folderName}`);
  }
  return folder;
}

async function findExistingDoc(projectId, file) {
  return FinanceDocument.findOne({
    project: projectId,
    isFolder: { $ne: true },
    fileName: file.name,
    fileSize: file.size,
  });
}

async function importFile(file, projectId, folderId, adminUser, tenantId) {
  if (DRY_RUN) {
    console.log(`    [dry-run] ${folderId ? '[folder] ' : '[root] '}${file.name}`);
    return 'dry';
  }

  const existing = await findExistingDoc(projectId, file);
  if (existing) {
    const wantFolder = folderId ? folderId.toString() : null;
    const haveFolder = existing.folderId ? existing.folderId.toString() : null;
    if (wantFolder !== haveFolder) {
      existing.folderId = folderId || null;
      await existing.save();
      return 'folder-fixed';
    }
    return 'skip';
  }

  const buffer = fs.readFileSync(file.path);
  const mimeType = getMimeType(file.name);

  let parsed = { extractedText: '', metadata: {} };
  if (!SKIP_OCR) {
    try {
      parsed = await parseDocument(buffer, mimeType);
    } catch (err) {
      console.warn(`    OCR skip ${file.name}:`, err.message);
    }
  }

  const utFile = new UTFile([buffer], file.name, { type: mimeType });
  const uploadResult = await utapi.uploadFiles([utFile]);
  if (!uploadResult[0]?.data) {
    throw new Error(uploadResult[0]?.error?.message || 'Upload failed');
  }

  const { url, key } = uploadResult[0].data;

  const doc = new FinanceDocument({
    title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim(),
    description: folderId ? 'Imported into folder' : 'Imported at project root',
    project: projectId,
    folderId: folderId || null,
    category: parsed.metadata?.detectedCategory || 'invoice',
    fileUrl: url,
    fileKey: key,
    fileName: file.name,
    fileSize: file.size,
    fileType: mimeType,
    uploadedBy: adminUser._id,
    extractedText: parsed.extractedText || '',
    metadata: {
      amount: parsed.metadata?.amount || 0,
      currency: parsed.metadata?.currency || 'INR',
      vendor: parsed.metadata?.vendor || '',
      date: parsed.metadata?.date || null,
      tax: parsed.metadata?.tax || 0,
      detectedCategory: parsed.metadata?.detectedCategory || 'invoice',
    },
    tenantId,
  });

  await doc.save();
  return 'ok';
}

async function run() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : FRESH ? '=== FRESH IMPORT ===' : '=== INCREMENTAL IMPORT ===');
  if (SKIP_OCR) console.log('OCR disabled (--skip-ocr)');

  await mongoose.connect(process.env.MONGODB_URI);

  const adminUser = (await User.findOne({ role: 'admin' })) || (await User.findOne({}));
  if (!adminUser) {
    console.error('No user found.');
    process.exit(1);
  }
  const tenantId = adminUser.tenantId;

  const stats = { ok: 0, skip: 0, fixed: 0, err: 0, dry: 0 };

  for (const source of SOURCE_ROOTS) {
    console.log(`\n--- ${source.label} ---`);
    const scan = scanSourceRoot(source.dir);
    if (scan.missing) {
      console.error(`Missing directory: ${source.dir}`);
      continue;
    }

    const totalDisk = scan.rootFiles.length + scan.folders.reduce((n, f) => n + f.files.length, 0);
    console.log(`Disk: ${scan.rootFiles.length} root, ${scan.folders.length} folder(s), ${totalDisk} files total`);
    scan.folders.forEach((f) => console.log(`  • ${f.folderName}: ${f.files.length} files`));

    const project = await getOrCreateProject(source.projectName, adminUser, tenantId);
    if (!project?._id && DRY_RUN) continue;

    if (FRESH && !DRY_RUN) await purgeProjectFinance(project._id);

    for (const file of scan.rootFiles) {
      try {
        const r = await importFile(file, project._id, null, adminUser, tenantId);
        stats[r === 'ok' ? 'ok' : r === 'skip' ? 'skip' : r === 'folder-fixed' ? 'fixed' : 'dry']++;
        console.log(`  ${r === 'ok' ? '✓' : r === 'skip' ? '○' : r === 'folder-fixed' ? '↻' : '~'} root: ${file.name}`);
      } catch (e) {
        stats.err++;
        console.error(`  ✗ root: ${file.name}`, e.message);
      }
    }

    for (const folder of scan.folders) {
      const folderDoc = await getOrCreateFolder(project._id, folder.folderName, adminUser, tenantId);
      const folderId = folderDoc?._id;

      for (const file of folder.files) {
        try {
          const r = await importFile(file, project._id, folderId, adminUser, tenantId);
          stats[r === 'ok' ? 'ok' : r === 'skip' ? 'skip' : r === 'folder-fixed' ? 'fixed' : 'dry']++;
          console.log(`  ${r === 'ok' ? '✓' : r === 'skip' ? '○' : r === 'folder-fixed' ? '↻' : '~'} ${folder.folderName}/${file.name}`);
        } catch (e) {
          stats.err++;
          console.error(`  ✗ ${folder.folderName}/${file.name}`, e.message);
        }
      }
    }
  }

  if (!DRY_RUN) {
    console.log('\n--- Syncing folder placement from disk ---');
    const syncResults = await syncFolderPlacementFromDisk(adminUser._id);
    for (const r of syncResults) {
      console.log(JSON.stringify(r, null, 2));
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Uploaded: ${stats.ok}, Skipped (exists): ${stats.skip}, Folder fixed: ${stats.fixed}, Errors: ${stats.err}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
