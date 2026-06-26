const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const { formatProjectName } = require('../utils/formatProjectName');
const { normalizeStoredProjectRole } = require('../../shared/projectRoles');

function readMongoUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => /^MONGODB_URI=/.test(l));
  if (!line) throw new Error('MONGODB_URI not found');
  return line.replace(/^MONGODB_URI=/, '').trim().replace(/^["']|["']$/g, '');
}

const OWNER_ID = '6a03b8ac51c059f0ec56d385'; // Raghav
const MEMBERS = [
  { userId: '6a03b8ad51c059f0ec56d38b', role: 'admin' }, // Ops
  { userId: '6a03b8ac51c059f0ec56d385', role: 'admin' }, // Raghav
  { userId: '6a03b8ad51c059f0ec56d389', role: 'admin' }, // Rohith
];
const TENANT_ID = '6a14c0d1d2ce3fb936553e35';

(async () => {
  await mongoose.connect(readMongoUri());

  const existing = await Project.findOne({
    name: formatProjectName('Monthly Payments'),
    workspace: 'TSC CORPORATE',
  });
  if (existing) {
    console.log('Project already exists:', existing._id.toString());
    await mongoose.disconnect();
    return;
  }

  const members = [];
  const memberRoles = [];
  for (const m of MEMBERS) {
    if (!members.some((id) => id.toString() === m.userId)) {
      members.push(new mongoose.Types.ObjectId(m.userId));
      memberRoles.push({
        user: new mongoose.Types.ObjectId(m.userId),
        role: normalizeStoredProjectRole(m.role),
      });
    }
  }

  const project = await Project.create({
    name: formatProjectName('Monthly Payments'),
    description: '',
    workspace: 'TSC CORPORATE',
    color: '#64748b',
    outletId: 'main',
    owner: new mongoose.Types.ObjectId(OWNER_ID),
    members,
    memberRoles,
    tenantId: new mongoose.Types.ObjectId(TENANT_ID),
  });

  console.log('Created project:', project._id.toString(), project.name, project.workspace);
  await mongoose.disconnect();
})().catch((e) => {
  console.error('FAILED:', e.message);
  console.error(e);
  process.exit(1);
});
