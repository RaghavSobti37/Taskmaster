const { isSupabaseEnabled, isLogsPrimarySupabase } = require('../../config/supabase');
const logger = require('../../utils/logger');
const {
  mirrorAsync,
  insertAppLog,
  insertSystemLog,
  insertCrmAudit,
  insertXpAuditLog,
  insertQaTestRun,
} = require('./logStore');

let registered = false;

function isEventBusSyncEnabled() {
  const raw = String(process.env.EVENT_BUS_SYNC || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function registerSupabaseMirrors() {
  if (registered || !isSupabaseEnabled()) return;
  registered = true;

  if (isEventBusSyncEnabled()) {
    logger.debug('SupabaseMirror', 'Skipped post-save mirrors — EVENT_BUS_SYNC=true');
    return;
  }

  const Log = require('../../models/Log');
  const SystemLog = require('../../models/SystemLog');
  const CRMAudit = require('../../models/CRMAudit');
  const XPAuditLog = require('../../models/XPAuditLog');
  const QATestRun = require('../../models/QATestRun');

  Log.schema.post('save', function onLogSaved(doc) {
    mirrorAsync(insertAppLog, doc);
  });

  if (!isLogsPrimarySupabase()) {
    SystemLog.schema.post('save', function onSystemLogSaved(doc) {
      mirrorAsync(insertSystemLog, doc);
    });
  }

  CRMAudit.schema.post('save', function onCrmAuditSaved(doc) {
    mirrorAsync(insertCrmAudit, doc);
  });

  XPAuditLog.schema.post('save', function onXpAuditSaved(doc) {
    mirrorAsync(insertXpAuditLog, doc);
  });

  QATestRun.schema.post('save', function onQaRunSaved(doc) {
    mirrorAsync(insertQaTestRun, doc);
  });

  logger.debug('SupabaseMirror', 'Realtime Mongo → Supabase mirrors registered');
}

module.exports = { registerSupabaseMirrors, isEventBusSyncEnabled };
