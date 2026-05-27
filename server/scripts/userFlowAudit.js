const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const axios = require('axios');
const User = require('../models/User');

const API_BASE = 'http://localhost:5000/api';

async function generateAdminToken() {
  const admin = await User.findOne({ role: 'admin' }) || await User.findOne();
  if (!admin) throw new Error('No user found');
  return jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
}

async function runAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const token = await generateAdminToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Clear performance log
  const logPath = path.join(__dirname, '../performance.log');
  if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  const testCall = async (method, url, data = null) => {
    try {
      await axios({ method, url: `${API_BASE}${url}`, headers, data });
    } catch (err) {
      console.log(`Failed ${url}: ${err.message}`);
    }
  };

  // 1. Auth (/api/auth/me) 3 times
  await testCall('GET', '/auth/me');
  await testCall('GET', '/auth/me');
  await testCall('GET', '/auth/me');

  // 2. Dashboard (/api/crm/stats)
  await testCall('GET', '/crm/stats');

  // 3. Webhook Book Call (/api/webhook/book-call)
  await testCall('POST', '/webhook/book-call', {
    name: 'Audit Test',
    email: 'audit@test.com',
    phone: '9999999999',
    course: 'Audit Course',
    date: '2026-06-01',
    time: '14:00'
  });
  // Immediately navigate to CRM leads
  await testCall('GET', '/crm/leads?page=1&limit=10');

  // 4. CRM Depth (Scroll through 5 pages)
  await testCall('GET', '/crm/leads?page=2&limit=10');
  await testCall('GET', '/crm/leads?page=3&limit=10');
  await testCall('GET', '/crm/leads?page=4&limit=10');
  await testCall('GET', '/crm/leads?page=5&limit=10');
  
  // 5. Export
  await testCall('GET', '/crm/export?format=csv');

  // 6. Calendar check
  await testCall('GET', '/calendar');

  // 7. Admin Log tab
  await testCall('GET', '/logs');

  console.log('Flow complete. Reading performance.log...');
  
  setTimeout(() => {
    const logs = fs.readFileSync(logPath, 'utf8');
    console.log('\n--- PERFORMANCE LOG ---');
    console.log(logs);
    process.exit(0);
  }, 1000);
}

runAudit().catch(console.error);
