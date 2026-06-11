const Lead = require('../models/Lead');
const CRMAudit = require('../models/CRMAudit');
const CRMImport = require('../models/CRMImport');
const { isAdminUser, getDepartmentSlug } = require('../../../utils/departmentPermissions');
const { resolveCrmScope } = require('../../../utils/crmScope');

async function listImports(user, queryParams) {
  const importQuery = {};
  const { crmType } = resolveCrmScope(user, queryParams.crmType);
  if (crmType) importQuery.crmType = crmType;
  else if (queryParams.crmType) importQuery.crmType = queryParams.crmType;

  return CRMImport.find(importQuery)
    .populate('createdBy', 'name')
    .sort('-createdAt')
    .lean();
}

async function deleteImportBatch(user, importId, reason) {
  if (!isAdminUser(user)) {
    return { error: 'ADMIN CLEARANCE REQUIRED', status: 403 };
  }
  const batch = await CRMImport.findById(importId);
  if (!batch) return { error: 'Import batch not found', status: 404 };

  const result = await Lead.deleteMany({ importId });
  await CRMImport.findByIdAndDelete(importId);

  await CRMAudit.create({
    userId: user._id,
    userRole: getDepartmentSlug(user),
    action: 'BATCH_DELETE',
    fieldChanged: 'batch',
    oldValue: batch.filename,
    newValue: 'DELETED',
    notes: reason || 'No reason provided',
  });

  return { message: `${result.deletedCount} leads successfully purged from system.` };
}

async function queueCsvImport({ filePath, originalname, userId, mapping }) {
  const { importQueue } = require('../../../workers/importWorker');
  return importQueue.add('csv-import', {
    filePath,
    originalname,
    userId,
    mapping,
  });
}

async function getImportJobStatus(jobId) {
  const { importQueue } = require('../../../workers/importWorker');
  const job = await importQueue.getJob(jobId);
  if (!job) return { error: 'Job not found', status: 404 };
  const state = await job.getState();
  const progress = job.progress;
  return { id: job.id, state, progress };
}

function readDebugColumns(res) {
  const csv = require('csv-parser');
  const fs = require('fs');
  const path = require('path');
  const CSV_PATH = path.join(__dirname, '../../../../Master Format CRM.csv');

  if (!fs.existsSync(CSV_PATH)) {
    return { error: 'Master CSV not found', status: 404 };
  }

  return new Promise((resolve) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('headers', (headers) => {
        resolve({
          columns: headers,
          currentMapping: global.crmMapping || {},
        });
      })
      .on('error', (err) => resolve({ error: err.message, status: 500 }));
  });
}

function saveColumnMapping(mapping) {
  global.crmMapping = mapping;
  return { message: 'Mapping synchronized' };
}

module.exports = {
  listImports,
  deleteImportBatch,
  queueCsvImport,
  getImportJobStatus,
  readDebugColumns,
  saveColumnMapping,
};
