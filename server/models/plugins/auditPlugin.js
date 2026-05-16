const mongoose = require('mongoose');
const CRMAudit = require('../CRMAudit');

/**
 * Audit Plugin for Mongoose
 * Tracks changes to specified fields and logs them to CRMAudit.
 */
const auditPlugin = (schema, options = {}) => {
  schema.pre('save', async function(next) {
    if (this.isNew) return next();

    const modifiedPaths = this.modifiedPaths();
    if (modifiedPaths.length === 0) return next();

    const userId = this._updatedBy || 'SYSTEM';
    const userRole = this._updatedByRole || 'SYSTEM';

    const auditLogs = [];

    modifiedPaths.forEach(path => {
      if (['updatedAt', 'lockedBy', 'lockedAt', '__v'].includes(path)) return;

      const oldValue = this._original ? this._original[path] : 'UNKNOWN';
      const newValue = this[path];

      if (String(oldValue) !== String(newValue)) {
        auditLogs.push({
          leadId: this._id,
          userId,
          userRole,
          fieldChanged: path,
          oldValue: String(oldValue),
          newValue: String(newValue),
          timestamp: new Date()
        });
      }
    });

    if (auditLogs.length > 0) {
      try {
        await CRMAudit.insertMany(auditLogs);
      } catch (err) {
        console.error('Audit Log Error:', err);
      }
    }
    next();
  });

  // Support for findOneAndUpdate/findByIdAndUpdate
  schema.pre('findOneAndUpdate', async function(next) {
    try {
      const update = this.getUpdate();
      const oldDoc = await this.model.findOne(this.getQuery());
      if (!oldDoc) return next();

      const userId = this.options.userId || 'SYSTEM';
      const userRole = this.options.userRole || 'SYSTEM';
      const auditLogs = [];

      const updateData = update.$set || update;

      for (const path in updateData) {
        if (['updatedAt', 'lockedBy', 'lockedAt', '__v'].includes(path)) continue;

        const oldValue = oldDoc[path];
        const newValue = updateData[path];

        if (String(oldValue) !== String(newValue)) {
          auditLogs.push({
            leadId: oldDoc._id,
            userId,
            userRole,
            fieldChanged: path,
            oldValue: String(oldValue || ''),
            newValue: String(newValue || ''),
            timestamp: new Date()
          });
        }
      }

      if (auditLogs.length > 0) {
        await CRMAudit.insertMany(auditLogs);
      }
    } catch (err) {
      console.error('Audit Middleware Error:', err);
    }
    next();
  });

  schema.post('init', function() {
    this._original = this.toObject();
  });
};

module.exports = auditPlugin;
