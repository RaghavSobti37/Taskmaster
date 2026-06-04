const PlatformSettings = require('../models/PlatformSettings');
const {
  parseUserIdList,
  OBJECT_ID_RE,
  setRuntimePlatformSettings,
  getRuntimePlatformSettings,
} = require('../../shared/platformUserIds');
const { PLATFORM_ROLE_FIELDS } = require('../../shared/platformRoleDefinitions');

const SINGLETON_KEY = 'global';
const USER_SELECT = 'name email departmentId';

const bootstrapFromEnv = () => ({
  rootAdminUserIds: parseUserIdList(process.env.ROOT_ADMIN_USER_IDS),
  platformOwnerUserId: parseObjectId(process.env.PLATFORM_OWNER_USER_ID),
  attendanceExcludedUserIds: parseUserIdList(process.env.ATTENDANCE_EXCLUDED_USER_IDS),
  qaExcludedUserIds: parseUserIdList(process.env.QA_EXCLUDED_USER_IDS),
  mailTemplateApproverUserIds: parseUserIdList(process.env.MAIL_TEMPLATE_APPROVER_USER_IDS),
  autoProjectMemberUserIds: parseUserIdList(process.env.AUTO_PROJECT_MEMBER_USER_IDS),
  qaAdminUserId: parseObjectId(process.env.QA_ADMIN_USER_ID),
});

function parseObjectId(raw) {
  const id = String(raw || '').trim();
  return OBJECT_ID_RE.test(id) ? id : null;
}

function docToRuntime(doc) {
  const d = doc || {};
  return {
    rootAdminUserIds: (d.rootAdminUserIds || []).map((id) => String(id)),
    platformOwnerUserId: d.platformOwnerUserId ? String(d.platformOwnerUserId) : null,
    attendanceExcludedUserIds: (d.attendanceExcludedUserIds || []).map((id) => String(id)),
    qaExcludedUserIds: (d.qaExcludedUserIds || []).map((id) => String(id)),
    mailTemplateApproverUserIds: (d.mailTemplateApproverUserIds || []).map((id) => String(id)),
    autoProjectMemberUserIds: (d.autoProjectMemberUserIds || []).map((id) => String(id)),
    qaAdminUserId: d.qaAdminUserId ? String(d.qaAdminUserId) : null,
  };
}

function normalizePayload(body = {}) {
  const out = {};
  for (const field of PLATFORM_ROLE_FIELDS) {
    const raw = body[field.key];
    if (raw === undefined) continue;
    if (field.multiple) {
      const list = Array.isArray(raw) ? raw : [];
      out[field.key] = list.map((id) => String(id).trim()).filter((id) => OBJECT_ID_RE.test(id));
    } else {
      const id = raw ? String(raw).trim() : '';
      out[field.key] = OBJECT_ID_RE.test(id) ? id : null;
    }
  }
  return out;
}

function userBrief(u) {
  if (!u) return null;
  const base = u.toObject ? u.toObject() : u;
  return {
    _id: base._id,
    name: base.name,
    email: base.email,
    departmentId: base.departmentId,
  };
}

function serializeForAdmin(doc) {
  const payload = { _id: doc._id, updatedAt: doc.updatedAt };
  for (const field of PLATFORM_ROLE_FIELDS) {
    if (field.multiple) {
      payload[field.key] = (doc[field.key] || []).map(userBrief);
    } else {
      payload[field.key] = userBrief(doc[field.key]);
    }
  }
  return payload;
}

async function populateSettingsDoc(doc) {
  const paths = PLATFORM_ROLE_FIELDS.map((f) => f.key);
  await doc.populate(paths.map((path) => ({ path, select: USER_SELECT, populate: { path: 'departmentId', select: 'name slug' } })));
  return doc;
}

async function loadPlatformSettings() {
  let doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY });
  if (!doc) {
    const seed = bootstrapFromEnv();
    const hasSeed = PLATFORM_ROLE_FIELDS.some((field) => {
      const v = seed[field.key];
      return Array.isArray(v) ? v.length > 0 : !!v;
    });
    doc = await PlatformSettings.create(
      hasSeed ? { singletonKey: SINGLETON_KEY, ...seed } : { singletonKey: SINGLETON_KEY }
    );
  }
  setRuntimePlatformSettings(docToRuntime(doc));
  return doc;
}

async function getAdminSettings() {
  const doc = await populateSettingsDoc(await loadPlatformSettings());
  return {
    settings: serializeForAdmin(doc),
    roles: PLATFORM_ROLE_FIELDS,
  };
}

async function updateAdminSettings(body, updatedBy) {
  const normalized = normalizePayload(body);
  const doc = await PlatformSettings.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    { $set: { ...normalized, updatedBy } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  setRuntimePlatformSettings(docToRuntime(doc));
  return getAdminSettings();
}

async function getExclusionsForClient() {
  await loadPlatformSettings();
  const runtime = getRuntimePlatformSettings();
  return {
    attendanceExcludedUserIds: runtime.attendanceExcludedUserIds || [],
    rootAdminUserIds: runtime.rootAdminUserIds || [],
  };
}

module.exports = {
  loadPlatformSettings,
  getAdminSettings,
  updateAdminSettings,
  getExclusionsForClient,
  PLATFORM_ROLE_FIELDS,
};
