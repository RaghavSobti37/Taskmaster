const PlatformSettings = require('../models/PlatformSettings');
const {
  parseUserIdList,
  OBJECT_ID_RE,
  setRuntimePlatformSettings,
  getRuntimePlatformSettings,
} = require('../../shared/platformUserIds');
const {
  PLATFORM_SETTINGS_FIELDS,
  PLATFORM_SETTINGS_SECTIONS,
} = require('../../shared/platformRoleDefinitions');

const SINGLETON_KEY = 'global';
const USER_SELECT = 'name email departmentId';

const LIST_FIELD_KEYS = PLATFORM_SETTINGS_FIELDS.filter((f) => f.multiple).map((f) => f.key);
const SINGLE_FIELD_KEYS = PLATFORM_SETTINGS_FIELDS.filter((f) => !f.multiple).map((f) => f.key);

const ENV_KEY_BY_FIELD = {
  rootAdminUserIds: 'ROOT_ADMIN_USER_IDS',
  platformOwnerUserId: 'PLATFORM_OWNER_USER_ID',
  attendanceExcludedUserIds: 'ATTENDANCE_EXCLUDED_USER_IDS',
  qaExcludedUserIds: 'QA_EXCLUDED_USER_IDS',
  mailTemplateApproverUserIds: 'MAIL_TEMPLATE_APPROVER_USER_IDS',
  autoProjectMemberUserIds: 'AUTO_PROJECT_MEMBER_USER_IDS',
  qaAdminUserId: 'QA_ADMIN_USER_ID',
  crmDigestRecipientUserIds: 'CRM_REACH_OUT_DIGEST_EMAIL',
  backupNotifyUserIds: 'BACKUP_NOTIFY_EMAIL',
  subscriptionReminderFallbackUserIds: 'SUBSCRIPTION_REMINDERS_EMAIL',
  passwordResetCcUserIds: 'ADMIN_EMAIL',
  primaryCallAssigneeUserId: 'PRIMARY_CALL_ASSIGNEE_ID',
  bookedCallSalesRepUserId: 'BOOKED_CALL_SALES_REP_ID',
};

const bootstrapFromEnv = () => {
  const seed = {};
  for (const field of PLATFORM_SETTINGS_FIELDS) {
    const envKey = ENV_KEY_BY_FIELD[field.key];
    if (!envKey) continue;
    if (field.multiple) {
      seed[field.key] = parseUserIdList(process.env[envKey]);
    } else {
      seed[field.key] = parseObjectId(process.env[envKey]);
    }
  }
  return seed;
};

function parseObjectId(raw) {
  const id = String(raw || '').trim();
  return OBJECT_ID_RE.test(id) ? id : null;
}

function docToRuntime(doc) {
  const d = doc || {};
  const out = {};
  for (const key of LIST_FIELD_KEYS) {
    out[key] = (d[key] || []).map((id) => String(id));
  }
  for (const key of SINGLE_FIELD_KEYS) {
    out[key] = d[key] ? String(d[key]) : null;
  }
  return out;
}

function normalizePayload(body = {}) {
  const out = {};
  for (const field of PLATFORM_SETTINGS_FIELDS) {
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
  for (const field of PLATFORM_SETTINGS_FIELDS) {
    if (field.multiple) {
      payload[field.key] = (doc[field.key] || []).map(userBrief);
    } else {
      payload[field.key] = userBrief(doc[field.key]);
    }
  }
  return payload;
}

async function populateSettingsDoc(doc) {
  const paths = PLATFORM_SETTINGS_FIELDS.map((f) => f.key);
  await doc.populate(
    paths.map((path) => ({
      path,
      select: USER_SELECT,
      populate: { path: 'departmentId', select: 'name slug' },
    }))
  );
  return doc;
}

async function loadPlatformSettings() {
  let doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY });
  if (!doc) {
    const seed = bootstrapFromEnv();
    const hasSeed = PLATFORM_SETTINGS_FIELDS.some((field) => {
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
    fields: PLATFORM_SETTINGS_FIELDS,
    sections: PLATFORM_SETTINGS_SECTIONS,
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
  try {
    const { refreshExcludedUserIds } = require('../utils/qaExcludedUsers');
    await refreshExcludedUserIds();
  } catch (_) {
    /* non-fatal */
  }
  return getAdminSettings();
}

async function getExclusionsForClient() {
  await loadPlatformSettings();
  const runtime = getRuntimePlatformSettings();
  return {
    attendanceExcludedUserIds: runtime.attendanceExcludedUserIds || [],
    rootAdminUserIds: runtime.rootAdminUserIds || [],
    qaExcludedUserIds: runtime.qaExcludedUserIds || [],
    mailTemplateApproverUserIds: runtime.mailTemplateApproverUserIds || [],
  };
}

module.exports = {
  loadPlatformSettings,
  getAdminSettings,
  updateAdminSettings,
  getExclusionsForClient,
  PLATFORM_SETTINGS_FIELDS,
};
