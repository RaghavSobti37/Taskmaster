const { dispatchEmailPayload } = require('./mailDriver');
const logger = require('../utils/logger');

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getNotifyEmail = () =>
  (process.env.BACKUP_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || '').trim();

const getFromEmail = () => {
  const raw = (process.env.BACKUP_FROM_EMAIL || 'noreply@theshakticollective.in').trim();
  if (raw.includes('<') && raw.includes('>')) return raw;
  return `"CoreKnot Backups" <${raw}>`;
};

const formatOriginalDbSize = (result) => {
  if (!result.sourceTotalSizeBytes && !result.sourceDataSizeBytes) return '—';
  const data = formatBytes(result.sourceDataSizeBytes || 0);
  const indexes = formatBytes(result.sourceIndexSizeBytes || 0);
  const total = formatBytes(result.sourceTotalSizeBytes || 0);
  const dbName = result.sourceDatabase ? ` (${result.sourceDatabase})` : '';
  return `${total}${dbName} — data ${data}, indexes ${indexes}`;
};

const buildSuccessHtml = (result) => {
  const collectionRows = (result.collections || [])
    .map(
      (col) =>
        `<tr><td>${col.collectionName}</td><td>${col.documentCount}</td><td>${formatBytes(col.compressedBytes)}</td></tr>`
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;">
      <h2 style="color:#15803d;">Daily backup succeeded</h2>
      <p>Production database backup completed successfully.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr><td><strong>Snapshot date (IST)</strong></td><td>${result.date}</td></tr>
        <tr><td><strong>Original DB size</strong></td><td>${formatOriginalDbSize(result)}</td></tr>
        <tr><td><strong>Backup database</strong></td><td>${result.backupDatabase}</td></tr>
        <tr><td><strong>Collections</strong></td><td>${result.collectionCount}</td></tr>
        <tr><td><strong>Compressed backup size</strong></td><td>${formatBytes(result.totalBytes)}</td></tr>
        <tr><td><strong>Duration</strong></td><td>${Math.round((result.durationMs || 0) / 1000)}s</td></tr>
        <tr><td><strong>Retention</strong></td><td>${result.retentionDays} days</td></tr>
      </table>
      ${
        collectionRows
          ? `<h3>Collections</h3>
             <table style="border-collapse:collapse;width:100%;">
               <thead><tr><th align="left">Collection</th><th align="left">Documents</th><th align="left">Size</th></tr></thead>
               <tbody>${collectionRows}</tbody>
             </table>`
          : ''
      }
      <p style="color:#666;font-size:13px;">Older snapshots are auto-deleted after ${result.retentionDays} days.</p>
    </div>
  `;
};

const buildFailureHtml = (result) => `
  <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;">
    <h2 style="color:#b91c1c;">Daily backup failed</h2>
    <p>Production database backup did not complete.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td><strong>Snapshot date (IST)</strong></td><td>${result.date || 'unknown'}</td></tr>
      <tr><td><strong>Backup database</strong></td><td>${result.backupDatabase || 'coreknot_backups'}</td></tr>
      <tr><td><strong>Error</strong></td><td>${result.error || 'Unknown error'}</td></tr>
      <tr><td><strong>Duration</strong></td><td>${Math.round((result.durationMs || 0) / 1000)}s</td></tr>
    </table>
    <p style="color:#666;font-size:13px;">Check Render cron logs for coreknot-daily-backup.</p>
  </div>
`;

const notifyBackupResult = async (result) => {
  const to = getNotifyEmail();
  if (!to) {
    logger.warn('BackupNotify', 'No BACKUP_NOTIFY_EMAIL or ADMIN_EMAIL configured; skipping email');
    return { sent: false, reason: 'missing_recipient' };
  }

  const subject = result.success
    ? `[CoreKnot] Backup succeeded — ${result.date}`
    : `[CoreKnot] Backup FAILED — ${result.date || 'unknown date'}`;

  const html = result.success ? buildSuccessHtml(result) : buildFailureHtml(result);
  const from = getFromEmail();

  const sendResult = await dispatchEmailPayload({ to, subject, html, from });

  logger.info('BackupNotify', `Backup notification sent to ${to}`, {
    success: result.success,
    resendId: sendResult?.id,
    sourceTotalSizeBytes: result.sourceTotalSizeBytes,
  });

  return { sent: true, to, resendId: sendResult?.id };
};

module.exports = {
  notifyBackupResult,
  getNotifyEmail,
  getFromEmail,
  formatOriginalDbSize,
};
