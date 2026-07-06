#!/usr/bin/env node
/**
 * Minimal seed for empty taskmaster_staging — one platform tenant + admin user.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://.../taskmaster_staging" node scripts/seed-staging-minimal.mjs
 *   # or with server/.env.render loaded:
 *   node scripts/seed-staging-minimal.mjs
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));

const uri = (
  process.env.MONGODB_URI_STAGING
  || process.env.STAGING_MONGODB_URI
  || process.env.MONGODB_URI
  || ''
).trim();

if (!uri.includes('taskmaster_staging')) {
  console.error('Refusing seed: URI must target taskmaster_staging');
  process.exit(1);
}

const adminEmail = String(process.env.STAGING_ADMIN_EMAIL || 'staging-admin@theshakticollective.in').trim().toLowerCase();
const adminName = process.env.STAGING_ADMIN_NAME || 'Staging Admin';

const tenantSchema = new mongoose.Schema({
  name: String,
  contactEmail: String,
  status: String,
}, { collection: 'tenants', strict: false });

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  tenantId: mongoose.Schema.Types.ObjectId,
  role: String,
  mustChangePassword: Boolean,
}, { collection: 'users', strict: false });

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);

await mongoose.connect(uri);
console.log('Connected to taskmaster_staging');

let tenant = await Tenant.findOne({ name: 'Staging Workspace' });
if (!tenant) {
  tenant = await Tenant.create({
    name: 'Staging Workspace',
    contactEmail: adminEmail,
    status: 'active',
  });
  console.log(`Created tenant ${tenant._id}`);
} else {
  console.log(`Tenant exists ${tenant._id}`);
}

let user = await User.findOne({ email: adminEmail });
if (!user) {
  user = await User.create({
    name: adminName,
    email: adminEmail,
    password: crypto.randomBytes(32).toString('hex'),
    tenantId: tenant._id,
    role: 'admin',
    mustChangePassword: true,
  });
  console.log(`Created admin ${adminEmail} (mustChangePassword=true — use forgot-password or Clerk)`);
} else {
  console.log(`Admin exists ${adminEmail}`);
}

await mongoose.disconnect();
console.log('Done.');
