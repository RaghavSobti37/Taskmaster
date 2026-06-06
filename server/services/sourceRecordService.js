const OutsourcedRecord = require('../models/OutsourcedRecord');
const BookedCall = require('../models/BookedCall');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { classifySourceRow, SOURCE_MODELS, classifierToInletKey } = require('../../shared/sourceClassifier');
const ContactService = require('./ContactService');
const { isCommunityText } = require('../../shared/dataInlets');

const MODEL_MAP = {
  [SOURCE_MODELS.OUTSOURCED]: OutsourcedRecord,
  [SOURCE_MODELS.BOOKED_CALL]: BookedCall,
  [SOURCE_MODELS.NEWSLETTER]: NewsletterSubscriber,
};

function buildIdentityFilter(doc) {
  const filter = { $or: [] };
  if (doc.email) filter.$or.push({ email: doc.email });
  if (doc.phone) filter.$or.push({ phone: doc.phone });
  return filter.$or.length ? filter : null;
}

function toBookedCallDoc(doc) {
  const bookedAt = doc.timestamp ? new Date(doc.timestamp) : doc.bookedAt || doc.createdAt || new Date();
  return {
    name: doc.name,
    nameKey: doc.nameKey,
    email: doc.email,
    phone: doc.phone,
    city: doc.city,
    bookedAt: Number.isNaN(bookedAt?.getTime()) ? new Date() : bookedAt,
    source: doc.originSource || doc.campaign || doc.dataType || doc.source,
    callStatus: doc.callStatus,
    importId: doc.importId,
    metadata: doc.metadata || {},
    emailStatus: doc.emailStatus,
  };
}

function toNewsletterDoc(doc) {
  return {
    name: doc.name,
    nameKey: doc.nameKey,
    email: doc.email,
    phone: doc.phone,
    city: doc.city,
    subscribedAt: doc.subscribedAt || doc.createdAt || new Date(),
    source: doc.originSource || doc.campaign || doc.sourceFilename || doc.source,
    unsubscribed: doc.emailStatus === 'Unsubscribed' || Boolean(doc.unsubscribed),
    importId: doc.importId,
    metadata: doc.metadata || {},
    emailStatus: doc.emailStatus,
  };
}

function toOutsourcedDoc(doc) {
  return {
    name: doc.name,
    nameKey: doc.nameKey,
    email: doc.email,
    phone: doc.phone,
    city: doc.city,
    state: doc.state,
    role: doc.role,
    campaign: doc.campaign,
    originSource: doc.originSource,
    destination: doc.destination,
    dataType: doc.dataType,
    sourceFilename: doc.sourceFilename,
    importId: doc.importId,
    metadata: doc.metadata || {},
    tags: doc.tags || [],
    emailStatus: doc.emailStatus,
  };
}

function docForModel(kind, doc) {
  switch (kind) {
    case SOURCE_MODELS.BOOKED_CALL:
      return toBookedCallDoc(doc);
    case SOURCE_MODELS.NEWSLETTER:
      return toNewsletterDoc(doc);
    default:
      return toOutsourcedDoc(doc);
  }
}

async function upsertClassifiedRow(rawDoc) {
  if (!rawDoc.email && !rawDoc.phone) return null;

  const isCommunity = isCommunityText(rawDoc.campaign) || isCommunityText(rawDoc.originSource);
  if (isCommunity) {
    const saved = await OutsourcedRecord.findOneAndUpdate(
      buildIdentityFilter(rawDoc) || {},
      { $set: toOutsourcedDoc(rawDoc) },
      { upsert: true, new: true, runValidators: true }
    );
    await ContactService.mergeContact({
      name: rawDoc.name,
      email: rawDoc.email,
      phone: rawDoc.phone,
      city: rawDoc.city,
      sourceFilename: rawDoc.sourceFilename,
      emailStatus: rawDoc.emailStatus,
      recordId: saved._id,
      summary: { campaign: rawDoc.campaign, originSource: rawDoc.originSource },
      inletKey: 'community',
    }, 'community');
    return { kind: 'community', record: saved };
  }

  const kind = classifySourceRow(rawDoc);
  const Model = MODEL_MAP[kind];
  const payload = docForModel(kind, rawDoc);
  const filter = buildIdentityFilter(payload);
  let saved;
  if (filter) {
    saved = await Model.findOneAndUpdate(filter, { $set: payload }, { upsert: true, new: true, runValidators: true });
  } else {
    saved = await Model.create(payload);
  }

  const inletKey = classifierToInletKey(kind);
  await ContactService.mergeContact({
    name: rawDoc.name,
    email: rawDoc.email,
    phone: rawDoc.phone,
    city: rawDoc.city,
    sourceFilename: rawDoc.sourceFilename,
    emailStatus: rawDoc.emailStatus,
    unsubscribed: rawDoc.unsubscribed,
    recordId: saved._id,
    summary: {
      campaign: rawDoc.campaign,
      originSource: rawDoc.originSource,
      role: rawDoc.role,
      source: payload.source,
    },
    inletKey,
  }, inletKey);

  return { kind, record: saved };
}

async function bulkUpsertClassifiedRows(docs) {
  const results = [];
  for (const doc of docs) {
    try {
      const r = await upsertClassifiedRow(doc);
      if (r) results.push(r);
    } catch {
      /* skip bad rows */
    }
  }
  return results;
}

module.exports = {
  upsertClassifiedRow,
  bulkUpsertClassifiedRows,
  docForModel,
  MODEL_MAP,
};
