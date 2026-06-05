const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Task = require('../models/Task');
const Project = require('../models/Project');
const CONTACT_BYPASS = { bypassTenant: true };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Prefer MongoDB text index for queries ≥3 chars; fall back to regex. */
async function findWithTextOrRegex(Model, baseFilter, q, regexFields, limit, options = {}) {
  if (q.length >= 3) {
    try {
      const rows = await Model.find({ ...baseFilter, $text: { $search: q } })
        .select(options.select || undefined)
        .setOptions(options.setOptions || {})
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();
      if (rows.length) return rows;
    } catch {
      /* index may not exist yet — regex fallback */
    }
  }
  const regex = new RegExp(escapeRegex(q), 'i');
  return Model.find({
    ...baseFilter,
    $or: regexFields.map((field) => ({ [field]: regex })),
  })
    .select(options.select || undefined)
    .setOptions(options.setOptions || {})
    .limit(limit)
    .lean();
}

const searchLeads = async (tenantId, q, limit) => {
  const leads = await findWithTextOrRegex(
    Lead,
    { tenantId },
    q,
    ['name', 'email', 'phone', 'city'],
    limit,
    { select: 'name email phone city lockedBy lockedAt' }
  );
  return leads.map((l) => ({
    type: 'lead',
    id: l._id.toString(),
    label: l.name,
    sublabel: l.email || l.phone || '',
    path: `/leads?highlight=${l._id}`,
    lockedBy: l.lockedBy || null,
  }));
};

const searchContacts = async (q, limit) => {
  const contacts = await findWithTextOrRegex(
    Contact,
    {},
    q,
    ['name', 'email', 'phone'],
    limit,
    { select: 'name email phone', setOptions: CONTACT_BYPASS }
  );
  return contacts.map((c) => ({
    type: 'contact',
    id: c._id.toString(),
    label: c.name,
    sublabel: c.email || c.phone || '',
    path: `/admin/crm?person=${c._id}`,
  }));
};

const searchTasks = async (tenantId, q, limit) => {
  const oidMatch = q.match(/^[a-f0-9]{24}$/i);
  if (oidMatch) {
    const tasks = await Task.find({ tenantId, _id: oidMatch[0] })
      .select('title status projectId')
      .limit(limit)
      .lean();
    return tasks.map((t) => ({
      type: 'task',
      id: t._id.toString(),
      label: t.title,
      sublabel: t.status || '',
      path: t.projectId
        ? `/projects/${t.projectId}?task=${t._id}`
        : `/todo?highlight=${t._id}`,
    }));
  }

  const tasks = await findWithTextOrRegex(
    Task,
    { tenantId },
    q,
    ['title', 'description'],
    limit,
    { select: 'title status projectId' }
  );
  return tasks.map((t) => ({
    type: 'task',
    id: t._id.toString(),
    label: t.title,
    sublabel: t.status || '',
    path: t.projectId
      ? `/projects/${t.projectId}?task=${t._id}`
      : `/todo?highlight=${t._id}`,
  }));
};

const searchProjects = async (tenantId, q, limit) => {
  const regex = new RegExp(escapeRegex(q), 'i');
  const projects = await Project.find({
    tenantId,
    $or: [{ name: regex }, { outletId: regex }],
  })
    .select('name outletId')
    .limit(limit)
    .lean();
  return projects.map((p) => ({
    type: 'project',
    id: p._id.toString(),
    label: p.name,
    sublabel: p.outletId || '',
    path: `/projects/${p._id}`,
  }));
};

exports.unifiedSearch = async ({ tenantId, q, types, limit = 8 }) => {
  const query = (q || '').trim();
  if (!query || query.length < 2) {
    return { results: [], query };
  }

  const allowed = types?.length ? types : ['lead', 'contact', 'task', 'project'];
  const perType = Math.max(2, Math.ceil(limit / allowed.length));
  const results = [];

  if (allowed.includes('lead')) {
    results.push(...(await searchLeads(tenantId, query, perType)));
  }
  if (allowed.includes('contact')) {
    results.push(...(await searchContacts(query, perType)));
  }
  if (allowed.includes('task')) {
    results.push(...(await searchTasks(tenantId, query, perType)));
  }
  if (allowed.includes('project')) {
    results.push(...(await searchProjects(tenantId, query, perType)));
  }

  return { results: results.slice(0, limit), query };
};
