const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const axios = require('axios');

// Configure this token to a valid admin token to bypass auth middleware during tests
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'dummy_token';
const API_BASE = 'http://localhost:5000/api';

const routeMap = [
  { page: "Dashboard", url: "/tasks", method: "GET" },
  { page: "ProjectsPage", url: "/projects", method: "GET" },
  { page: "LeadsPage", url: "/leads", method: "GET" },
  { page: "CampaignsPage", url: "/campaigns", method: "GET" }
];

async function runAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB for Audit');
  
  // Mongoose debug mode intercepts queries
  mongoose.set('debug', true);

  const report = [];

  for (const route of routeMap) {
    console.log(`Auditing: ${route.page} -> ${route.url}`);
    const startTime = process.hrtime();
    let responseTime = 0;
    let success = false;
    
    try {
      // Step A & B: Trigger request
      const res = await axios({
        method: route.method,
        url: `${API_BASE}${route.url}`,
        headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` },
        validateStatus: () => true // Resolve all statuses
      });

      const diff = process.hrtime(startTime);
      responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
      success = res.status < 400;

      // Note: Getting true MongoDB executionStats for the exact HTTP request is 
      // complex without deep middleware instrumentation. 
      // As a proxy, we record the response time and mock the frontend/DB schema structure required.
      
      report.push({
        page: route.page,
        frontend: { lcp: "N/A", renderTime: "N/A" },
        backend: { responseTime: `${responseTime}ms`, status: res.status, route: route.url },
        database: { 
          query: "Logged via mongoose debug",
          executionStats: { note: "Check console for mongoose.set('debug') output" }
        }
      });
      
    } catch (err) {
      console.error(`Failed ${route.url}:`, err.message);
    }
  }

  const reportPath = path.join(__dirname, 'audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nAudit complete! Report saved to ${reportPath}`);
  
  process.exit(0);
}

runAudit().catch(console.error);
