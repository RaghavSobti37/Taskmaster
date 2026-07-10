#!/usr/bin/env node
/**
 * Seed idempotent E2E test users — one per department slug + project role assignments.
 *
 * Usage (from repo root or server/):
 *   node server/scripts/seedE2eUsers.js
 *   node server/scripts/seedE2eUsers.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { seedDepartments, DEFAULT_DEPARTMENTS } = require('../services/departmentService');
const { resolveDefaultTenantId } = require('../utils/defaultTenant');
const { runWithContext } = require('../utils/tenantContext');
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
const { E2E_PW_GATE_EMAIL, E2E_PW_GATE_TEMP_PASSWORD } = require('../utils/e2eTestUsers');
const { getRandomAvatar } = require('../utils/avatarGenerator');
const { formatProjectName } = require('../utils/formatProjectName');
const { PRESET_PAGES } = require('../utils/pagePermissions');

const BYPASS = { bypassTenant: true };
const E2E_EMAIL_DOMAIN = 'test.coreknot.local';
const MANIFEST_PATH = path.join(__dirname, '../../.agents/e2e-users.json');

const DRY_RUN = process.argv.includes('--dry-run');

/** Stored project role by manifest alias (lead = manager unless owner). */
const ROLE_ALIAS_TO_STORED = {
  lead: 'manager',
  member: 'member',
  viewer: 'viewer',
};

const DEPT_ARCHETYPES = DEFAULT_DEPARTMENTS.map((dept) => ({
  archetype: `dept-${dept.slug}`,
  slug: dept.slug,
  name: dept.name,
  permissionPreset: dept.permissionPreset,
}));

const E2E_PROJECTS = [
  {
    key: 'sandbox',
    name: '[E2E] Sandbox',
    workspace: 'GENERAL',
    outletId: 'e2e',
    description: 'Primary E2E project for role permutations',
    ownerArchetype: 'dept-admin',
    assignments: [
      { archetype: 'dept-ops', role: 'lead' },
      { archetype: 'dept-sales', role: 'member' },
      { archetype: 'dept-creative', role: 'viewer' },
    ],
  },
  {
    key: 'secondary',
    name: '[E2E] Secondary',
    workspace: 'GENERAL',
    outletId: 'e2e',
    description: 'Secondary E2E project (minimal cross-project checks)',
    ownerArchetype: 'dept-creative',
    assignments: [
      { archetype: 'dept-artist-management', role: 'lead' },
      { archetype: 'dept-sales', role: 'member' },
    ],
  },
];

function archetypeEmail(archetype) {
  return `e2e-${archetype}@${E2E_EMAIL_DOMAIN}`.toLowerCase();
}

function displayNameForDept(deptName) {
  return `E2E ${deptName}`;
}

async function upsertUser(User, Department, spec, password) {
  const email = archetypeEmail(spec.archetype);
  const dept = await Department.findOne({ slug: spec.slug }).setOptions(BYPASS);
  if (!dept) {
    throw new Error(`Department slug "${spec.slug}" not found — run seedDepartments first`);
  }

  let user = await User.findOne({ email }).select('+password').setOptions(BYPASS);
  const payload = {
    name: displayNameForDept(spec.name),
    email,
    departmentId: dept._id,
    mustChangePassword: false,
    passwordChangedAt: new Date(),
  };

  if (!user) {
    if (DRY_RUN) {
      return { email, _id: null, created: true, dept };
    }
    user = await User.create({
      ...payload,
      password,
      gender: 'other',
      avatar: getRandomAvatar('other'),
      ...(spec.slug === 'sales' ? { repId: 'e2e-sr01' } : {}),
    });
    return { email, _id: user._id, created: true, dept };
  }

  let changed = false;
  if (user.departmentId?.toString() !== dept._id.toString()) {
    user.departmentId = dept._id;
    changed = true;
  }
  if (!user.password) {
    user.password = password;
    changed = true;
  } else {
    const matches = await user.comparePassword(password);
    if (!matches) {
      user.password = password;
      changed = true;
    }
  }
  if (user.mustChangePassword !== false) {
    user.mustChangePassword = false;
    changed = true;
  }
  user.passwordChangedAt = new Date();
  if (spec.slug === 'sales' && !user.repId) {
    user.repId = 'e2e-sr01';
    changed = true;
  }
  if (changed && !DRY_RUN) {
    await user.save();
  }
  return { email, _id: user._id, created: false, dept };
}

async function upsertPasswordGateUser(User) {
  const email = E2E_PW_GATE_EMAIL;
  let user = await User.findOne({ email }).select('+password').setOptions(BYPASS);

  if (!user) {
    if (DRY_RUN) {
      return { email, _id: null, created: true };
    }
    user = await User.create({
      name: 'E2E Password Gate',
      email,
      password: E2E_PW_GATE_TEMP_PASSWORD,
      mustChangePassword: true,
      gender: 'other',
      avatar: getRandomAvatar('other'),
    });
    return { email, _id: user._id, created: true };
  }

  let changed = false;
  const matches = user.password
    ? await user.comparePassword(E2E_PW_GATE_TEMP_PASSWORD)
    : false;
  if (!matches) {
    user.password = E2E_PW_GATE_TEMP_PASSWORD;
    changed = true;
  }
  if (user.mustChangePassword !== true) {
    user.mustChangePassword = true;
    changed = true;
  }
  user.passwordChangedAt = null;
  if (changed && !DRY_RUN) {
    await user.save();
  }
  return { email, _id: user._id, created: false };
}

function resolveManifestRole(projectSpec, archetype) {
  if (projectSpec.ownerArchetype === archetype) return 'lead';
  const hit = projectSpec.assignments.find((a) => a.archetype === archetype);
  return hit?.role || null;
}

function storedRoleForAssignment(projectSpec, archetype) {
  const alias = resolveManifestRole(projectSpec, archetype);
  if (!alias) return null;
  if (alias === 'lead' && projectSpec.ownerArchetype === archetype) return 'admin';
  return ROLE_ALIAS_TO_STORED[alias] || 'member';
}

async function upsertProject(Project, projectSpec, usersByArchetype) {
  const owner = usersByArchetype[projectSpec.ownerArchetype];
  if (!owner?._id) {
    throw new Error(`Missing owner user for project ${projectSpec.name}`);
  }

  const members = [owner._id];
  const memberRoles = [];

  for (const assignment of projectSpec.assignments) {
    const u = usersByArchetype[assignment.archetype];
    if (!u?._id) continue;
    if (!members.some((id) => id.toString() === u._id.toString())) {
      members.push(u._id);
    }
    memberRoles.push({
      user: u._id,
      role: ROLE_ALIAS_TO_STORED[assignment.role] || 'member',
    });
  }

  if (!members.some((id) => id.toString() === owner._id.toString())) {
    members.unshift(owner._id);
  }

  const formattedName = formatProjectName(projectSpec.name);
  const existing = await Project.findOne({ name: formattedName }).setOptions(BYPASS);
  const doc = {
    name: formattedName,
    description: projectSpec.description,
    workspace: projectSpec.workspace,
    outletId: projectSpec.outletId,
    owner: owner._id,
    members,
    memberRoles,
    status: 'active',
    color: '#126d5e',
  };

  if (DRY_RUN) {
    return { ...doc, _id: existing?._id || null, created: !existing };
  }

  if (existing) {
    existing.description = doc.description;
    existing.workspace = doc.workspace;
    existing.outletId = doc.outletId;
    existing.owner = doc.owner;
    existing.members = doc.members;
    existing.memberRoles = doc.memberRoles;
    existing.status = doc.status;
    await existing.save();
    return { ...doc, _id: existing._id, created: false };
  }

  const created = await Project.create(doc);
  return { ...doc, _id: created._id, created: true };
}

function buildManifest(password, usersByArchetype, projects) {
  const manifestUsers = DEPT_ARCHETYPES.map((spec) => {
    const row = usersByArchetype[spec.archetype];
    const dept = row?.dept;
    const projectRoles = [];

    for (const projectSpec of E2E_PROJECTS) {
      const role = resolveManifestRole(projectSpec, spec.archetype);
      if (role) {
        projectRoles.push({ project: formatProjectName(projectSpec.name), role });
      }
    }

    return {
      email: archetypeEmail(spec.archetype),
      password,
      archetype: spec.archetype,
      department: {
        slug: spec.slug,
        name: spec.name,
        permissionPreset: dept?.permissionPreset || spec.permissionPreset,
        pagePermissions: dept?.pagePermissions?.length
          ? dept.pagePermissions
          : (PRESET_PAGES[spec.permissionPreset] || PRESET_PAGES.standard),
      },
      projectRoles,
      userId: row?._id ? String(row._id) : null,
    };
  });

  const pwGateRow = usersByArchetype['pw-gate'];
  manifestUsers.push({
    email: E2E_PW_GATE_EMAIL,
    password: E2E_PW_GATE_TEMP_PASSWORD,
    archetype: 'pw-gate',
    mustChangePassword: true,
    userId: pwGateRow?._id ? String(pwGateRow._id) : null,
  });

  return {
    generatedAt: new Date().toISOString(),
    password,
    emailPattern: `e2e-{archetype}@${E2E_EMAIL_DOMAIN}`,
    database: 'taskmaster_local',
    userCount: manifestUsers.length,
    users: manifestUsers,
    projects: projects.map((p) => ({
      name: p.name,
      workspace: p.workspace,
      projectId: p._id ? String(p._id) : null,
      ownerArchetype: E2E_PROJECTS.find(
        (s) => formatProjectName(s.name) === p.name
      )?.ownerArchetype,
    })),
  };
}

async function main() {
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!uri) {
    console.error('MONGODB_URI not set in server/.env');
    process.exit(1);
  }

  if (!uri.includes('taskmaster_local')) {
    console.error('Refusing to seed: MONGODB_URI must target taskmaster_local');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected: ${uri.replace(/\/\/[^@]+@/, '//***@')}`);

  const User = require('../models/User');
  const Department = require('../models/Department');
  const Project = require('../models/Project');

  const tenantId = await resolveDefaultTenantId();
  console.log(`Tenant: ${tenantId}`);

  await runWithContext({ tenantId: String(tenantId) }, async () => {
  const password = getDefaultSeedPassword();

  await seedDepartments();
  console.log('Departments ensured');

  const usersByArchetype = {};
  let createdUsers = 0;

  for (const spec of DEPT_ARCHETYPES) {
    const result = await upsertUser(User, Department, spec, password);
    usersByArchetype[spec.archetype] = result;
    if (result.created) createdUsers += 1;
    console.log(`${result.created ? 'created' : 'updated'}: ${result.email}`);
  }

  const pwGate = await upsertPasswordGateUser(User);
  usersByArchetype['pw-gate'] = pwGate;
  if (pwGate.created) createdUsers += 1;
  console.log(`${pwGate.created ? 'created' : 'updated'}: ${pwGate.email} (password gate)`);

  const projects = [];
  for (const projectSpec of E2E_PROJECTS) {
    const result = await upsertProject(Project, projectSpec, usersByArchetype);
    projects.push(result);
    console.log(`${result.created ? 'created' : 'updated'} project: ${projectSpec.name}`);
  }

  const manifest = buildManifest(password, usersByArchetype, projects);

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Manifest: ${MANIFEST_PATH}`);
  } else {
    console.log('Dry run — manifest not written');
  }

  console.log(`\nE2E users: ${manifest.userCount} (${createdUsers} newly created)`);
  });
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
