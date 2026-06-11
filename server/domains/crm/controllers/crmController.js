const logger = require('../../../utils/logger');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { assignLeadToRep, assignLeadToArtistRep } = require('../../../utils/crmAssignment');
const {
  fetchLeadsPaginated,
  fetchLeadById,
  streamLeadExport,
} = require('../services/leadQueryService');
const importService = require('../services/importService');
const leadWriteService = require('../services/leadWriteService');
const auditService = require('../services/auditService');
const crmConfigService = require('../services/crmConfigService');
const crmStatsService = require('../services/crmStatsService');
const followupService = require('../services/followupService');
const leadLockService = require('../services/leadLockService');

exports.assignLeadToRep = assignLeadToRep;
exports.assignLeadToArtistRep = assignLeadToArtistRep;

exports.getLeads = async (req, res) => {
  try {
    const result = await fetchLeadsPaginated(req.user, req.query);
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'in getLeads:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

exports.getLead = async (req, res) => {
  try {
    const result = await fetchLeadById(req.user, req.params.id, req.query);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.lead);
  } catch (error) {
    logger.error('crmController', 'in getLead:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

exports.createLead = async (req, res) => {
  try {
    const result = await leadWriteService.createLead(req.user, req.body);
    if (result.error) {
      const payload = { error: result.error };
      if (result.duplicateOf) payload.duplicateOf = result.duplicateOf;
      return res.status(result.status).json(payload);
    }
    res.status(result.status).json(result.lead);
  } catch (error) {
    logger.error('crmController', 'Create lead ', { error: error.message || error });
    res.status(400).json({ error: 'Failed to create lead' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const result = await leadWriteService.updateLead(req.user, req.params.id, req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.lead);
  } catch (error) {
    logger.error('crmController', 'Update lead ', { error: error.message || error, code: error.code });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A lead with this phone or email already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || 'Failed to update lead' });
  }
};

exports.getEmis = async (req, res) => {
  try {
    const emis = await leadWriteService.getEmis(req.params.leadId);
    res.json(emis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch EMIs' });
  }
};

exports.createEmi = async (req, res) => {
  try {
    const result = await leadWriteService.createEmi(req.params.leadId, req.body);
    res.status(result.status).json(result.emi);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create EMI' });
  }
};

exports.updateEmi = async (req, res) => {
  try {
    const result = await leadWriteService.updateEmi(req.params.id, req.body);
    res.json(result.emi);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update EMI' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await auditService.getAuditLogsForLead(req.params.leadId);
    res.json(logs);
  } catch (error) {
    logger.error('crmController', 'Failed to fetch lead audit logs:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

exports.getAllAuditLogs = async (req, res) => {
  try {
    const result = await auditService.getAllAuditLogs(req.query);
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'Failed to fetch all audit logs:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

exports.getImports = async (req, res) => {
  try {
    const imports = await importService.listImports(req.user, req.query);
    res.json(imports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch imports' });
  }
};

exports.deleteImport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await importService.deleteImportBatch(req.user, id, reason);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete import' });
  }
};

exports.getDebugColumns = async (req, res) => {
  const result = await importService.readDebugColumns(res);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
};

exports.saveMapping = async (req, res) => {
  res.json(importService.saveColumnMapping(req.body.mapping));
};

exports.uploadLeads = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file provided' });
  }

  try {
    const job = await importService.queueCsvImport({
      filePath: req.file.path,
      originalname: req.file.originalname,
      userId: req.user._id,
      mapping: global.crmMapping || {},
    });

    res.status(202).json({
      message: 'File uploaded successfully and queued for processing.',
      jobId: job.id,
    });
  } catch (error) {
    const fs = require('fs');
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) { }
    res.status(500).json({ error: 'Failed to queue import' });
  }
};

exports.getImportJobStatus = async (req, res) => {
  try {
    const result = await importService.getImportJobStatus(req.params.jobId);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job status' });
  }
};

exports.resetCRM = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    const result = await leadWriteService.resetCRM(req.user, req.body.reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset CRM' });
  }
};

exports.getPurgeLogs = async (req, res) => {
  try {
    const logs = await auditService.getPurgeLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purge logs' });
  }
};

exports.exportLeads = async (req, res) => {
  try {
    await streamLeadExport(res, req.query);
  } catch (error) {
    logger.error('crmController', 'Export Init ', { error: error.message || error });
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export leads' });
  }
};

exports.getCRMStats = async (req, res) => {
  try {
    const stats = await crmStatsService.getCRMStats(req.user, req.query);
    res.json(stats);
  } catch (error) {
    logger.error('crmController', 'CRM Stats ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch CRM stats' });
  }
};

exports.getFollowups = async (req, res) => {
  try {
    const result = await followupService.getFollowups(req.user, req.query);
    followupService.applyFollowupPaginationHeaders(res, result.pagination);
    res.json(result.data);
  } catch (error) {
    logger.error('crmController', 'Failed to fetch followups:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch followups' });
  }
};

exports.addNote = async (req, res) => {
  try {
    const result = await leadWriteService.addNote(req.user, req.params.id, req.body.text);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.lead);
  } catch (error) {
    logger.error('crmController', 'Add note audit ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to add note' });
  }
};

exports.getCRMConfig = async (req, res) => {
  try {
    const config = await crmConfigService.getCRMConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CRM config' });
  }
};

exports.getRepSummary = async (req, res) => {
  try {
    const summary = await crmStatsService.getRepSummary();
    res.json(summary);
  } catch (error) {
    logger.error('crmController', 'Rep summary ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch rep summary' });
  }
};

exports.cleanupTestData = async (req, res) => {
  try {
    const result = await leadWriteService.cleanupTestData();
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'Cleanup test data ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to cleanup test data' });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const result = await leadWriteService.deleteLead(req.user, req.params.id, req.query);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'Delete lead ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

exports.purgeAuditLogs = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    const result = await auditService.purgeAuditLogs();
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'Failed to purge lead audits:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to purge audit logs' });
  }
};

exports.releaseLeadLock = async (req, res) => {
  try {
    const result = await leadLockService.releaseLeadLock(req.params.id, req.user._id.toString());
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'Release lead lock', { error: error.message || error });
    res.status(500).json({ error: 'Failed to release lock' });
  }
};

exports.heartbeatLeadLock = async (req, res) => {
  try {
    const result = await leadLockService.heartbeatLeadLock(req.params.id, req.user._id.toString());
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (error) {
    logger.error('crmController', 'Heartbeat lead lock', { error: error.message || error });
    res.status(500).json({ error: 'Failed to refresh lock' });
  }
};
