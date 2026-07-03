/**
 * Sample migration — indexes for SecurityAudit enterprise retention queries.
 */
module.exports = {
  async up(db) {
    await db.collection('securityaudits').createIndex(
      { tenantId: 1, timestamp: -1 },
      { name: 'tenantId_timestamp_desc' },
    );
  },

  async down(db) {
    await db.collection('securityaudits').dropIndex('tenantId_timestamp_desc');
  },
};
