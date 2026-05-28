const fs = require('fs');
const path = require('path');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');

const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls', '.doc', '.docx'];

const DISK_TARGETS = [
  {
    projectName: 'Havells mYOUsic',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download (4)\\Havells mYOUsic',
    primaryFolderName: 'April 2026',
  },
  {
    projectName: 'TSC Academy',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download\\TSC Academy - Invoices',
    primaryFolderName: 'April 2026 - TSC Academy',
  },
  {
    projectName: 'Himalayan Harmonies',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download (3)\\Himalayan Harmonies',
    primaryFolderName: null,
  },
  {
    projectName: 'Dattadham',
    dir: 'C:\\Users\\ragha\\Downloads\\Basecamp Download (5)\\Dattadham',
    primaryFolderName: null,
  },
];

function scanSourceRoot(rootDir) {
  const folders = [];
  const rootFiles = [];

  if (!fs.existsSync(rootDir)) {
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

/** key = fileName|size → { placement: 'root' | 'folder', folderName? } */
function buildPlacementMap(scan) {
  const map = new Map();
  const conflicts = [];

  for (const f of scan.rootFiles) {
    const key = `${f.name}|${f.size}`;
    if (map.has(key)) conflicts.push({ key, reason: 'duplicate root on disk' });
    map.set(key, { placement: 'root', folderName: null, size: f.size });
  }

  for (const folder of scan.folders) {
    for (const f of folder.files) {
      const key = `${f.name}|${f.size}`;
      if (map.has(key)) {
        conflicts.push({ key, reason: 'same name+size in root and folder', prefer: folder.folderName });
      }
      map.set(key, { placement: 'folder', folderName: folder.folderName, size: f.size });
    }
  }

  // Fallback by fileName only for docs without size match
  const byName = new Map();
  for (const f of scan.rootFiles) {
    if (!byName.has(f.name)) byName.set(f.name, []);
    byName.get(f.name).push({ placement: 'root', folderName: null, size: f.size });
  }
  for (const folder of scan.folders) {
    for (const f of folder.files) {
      if (!byName.has(f.name)) byName.set(f.name, []);
      byName.get(f.name).push({ placement: 'folder', folderName: folder.folderName, size: f.size });
    }
  }

  return { byKey: map, byName, conflicts };
}

function resolvePlacement(fileName, fileSize, placementData) {
  const size = fileSize || 0;
  const key = `${fileName}|${size}`;
  if (placementData.byKey.has(key)) return placementData.byKey.get(key);

  const nameEntries = placementData.byName.get(fileName);
  if (!nameEntries?.length) return null;
  if (nameEntries.length === 1) return nameEntries[0];

  const sizeMatch = nameEntries.find((e) => e.size === size);
  if (sizeMatch) return sizeMatch;

  const folderMatch = nameEntries.find((e) => e.placement === 'folder');
  return folderMatch || nameEntries[0];
}

async function ensureFolder(projectId, folderName, uploadedBy) {
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
      uploadedBy,
      category: 'other',
    });
    await folder.save();
  }
  return folder;
}

async function syncFolderPlacementForTarget(target, uploadedBy) {
  const { projectName, dir, primaryFolderName } = target;
  const scan = scanSourceRoot(dir);

  if (scan.missing) {
    return { projectName, error: `Disk path not found: ${dir}` };
  }

  const project = await Project.findOne({
    name: { $regex: new RegExp(`^${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });
  if (!project) {
    return { projectName, error: 'Project not found' };
  }

  const placementData = buildPlacementMap(scan);
  const folderIdByName = {};

  for (const { folderName } of scan.folders) {
    const folder = await ensureFolder(project._id, folderName, uploadedBy);
    folderIdByName[folderName] = folder._id;
  }

  const docs = await FinanceDocument.find({
    project: project._id,
    isFolder: { $ne: true },
  });

  let assignedRoot = 0;
  let assignedFolder = 0;
  let unmatched = 0;
  const unmatchedFiles = [];

  for (const doc of docs) {
    const placement = resolvePlacement(doc.fileName, doc.fileSize, placementData);
    if (!placement) {
      unmatched++;
      unmatchedFiles.push(doc.fileName);
      continue;
    }

    if (placement.placement === 'root') {
      if (doc.folderId) {
        doc.folderId = null;
        await doc.save();
      }
      assignedRoot++;
    } else {
      const fid = folderIdByName[placement.folderName];
      if (!fid) {
        unmatched++;
        unmatchedFiles.push(doc.fileName);
        continue;
      }
      if (!doc.folderId || doc.folderId.toString() !== fid.toString()) {
        doc.folderId = fid;
        await doc.save();
      }
      assignedFolder++;
    }
  }

  const rootCount = await FinanceDocument.countDocuments({
    project: project._id,
    isFolder: { $ne: true },
    $or: [{ folderId: null }, { folderId: { $exists: false } }],
  });

  return {
    projectName,
    primaryFolderName,
    diskRootFiles: scan.rootFiles.length,
    diskFolderFiles: scan.folders.reduce((n, f) => n + f.files.length, 0),
    foldersOnDisk: scan.folders.map((f) => f.folderName),
    assignedRoot,
    assignedFolder,
    unmatched,
    unmatchedSample: unmatchedFiles.slice(0, 5),
    dbRootCount: rootCount,
    dbInPrimaryFolder: folderIdByName[primaryFolderName]
      ? await FinanceDocument.countDocuments({
          project: project._id,
          isFolder: { $ne: true },
          folderId: folderIdByName[primaryFolderName],
        })
      : 0,
    conflicts: placementData.conflicts.length,
  };
}

async function syncFolderPlacementFromDisk(uploadedBy) {
  const results = [];
  for (const target of DISK_TARGETS) {
    results.push(await syncFolderPlacementForTarget(target, uploadedBy));
  }
  return results;
}

module.exports = {
  DISK_TARGETS,
  scanSourceRoot,
  buildPlacementMap,
  syncFolderPlacementFromDisk,
  syncFolderPlacementForTarget,
};
