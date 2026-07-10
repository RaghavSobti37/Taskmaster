const mongoose = require('mongoose');

const OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'deletedAt', 'lastOnline', 'dateOfBirth',
  'passwordChangedAt', 'passwordResetExpires', 'expiresAt', 'startDate', 'endDate',
  'dueDate', 'completedAt', 'lastRecalculatedAt', 'date', 'loginAt', 'linkedAt',
]);

const isObjectIdString = (value) => typeof value === 'string' && OBJECT_ID_HEX.test(value);

const toObjectId = (value) => {
  if (value == null) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const str = String(value);
  if (!mongoose.Types.ObjectId.isValid(str)) return value;
  return new mongoose.Types.ObjectId(str);
};

const toDate = (value) => {
  if (value == null || value instanceof Date) return value;
  if (typeof value !== 'string') return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
};

/** Match BSON ObjectId or legacy string ids from GridFS backups. */
const idFilter = (id) => {
  if (id == null) return { _id: id };
  const str = String(id);
  if (!mongoose.Types.ObjectId.isValid(str)) return { _id: str };
  const oid = toObjectId(str);
  return { $or: [{ _id: oid }, { _id: str }] };
};

/** Match tenantId as ObjectId or legacy string. */
const tenantIdFilter = (tenantId) => {
  if (tenantId == null) return { tenantId };
  const str = String(tenantId);
  if (!mongoose.Types.ObjectId.isValid(str)) return { tenantId: str };
  const oid = toObjectId(str);
  return { $or: [{ tenantId: oid }, { tenantId: str }] };
};

const isRefField = (key) => (
  key === '_id'
  || /Id$/.test(key)
  || ['assignedTo', 'createdBy', 'updatedBy', 'owner', 'user'].includes(key)
);

const isDateField = (key) => DATE_FIELDS.has(key);

const normalizeFieldValue = (key, value) => {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFieldValue(key, entry));
  }
  if (
    typeof value === 'object'
    && !(value instanceof mongoose.Types.ObjectId)
    && !(value instanceof Date)
    && !Buffer.isBuffer(value)
  ) {
    return normalizeBackupDocument(value);
  }
  if (isObjectIdString(value) && isRefField(key)) {
    return toObjectId(value);
  }
  if (typeof value === 'string' && isDateField(key)) {
    return toDate(value);
  }
  return value;
};

const normalizeBackupDocument = (doc) => {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc;
  const out = { ...doc };
  for (const [key, value] of Object.entries(out)) {
    out[key] = normalizeFieldValue(key, value);
  }
  return out;
};

module.exports = {
  toObjectId,
  toDate,
  idFilter,
  tenantIdFilter,
  isObjectIdString,
  isRefField,
  isDateField,
  DATE_FIELDS,
  normalizeBackupDocument,
  normalizeFieldValue,
};
