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
  if (!admin) throw new Error('No user found to generate token.');
  // Assuming standard JWT signing pattern
  return jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
}

function discoverGetRoutes() {
  const routesDir = path.join(__dirname, '../routes');
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  const routesToTest = [];

  for (const file of files) {
    const routeContent = fs.readFileSync(path.join(routesDir, file), 'utf-8');
    const routeBase = file.replace('Routes.js', '').replace('.js', ''); 
    // e.g. taskRoutes.js -> task, but in server.js they might be mounted as /api/tasks
    // This is hard to guess automatically without parsing server.js.
    // Let's parse server.js to find mounts.
    const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf-8');
    const importName = file.replace('.js', '');
    // e.g. const projectRoutes = require('./routes/projectRoutes');
    // app.use('/api/projects', projectRoutes);
    const regexMount = new RegExp(`app\\.use\\(['"\`](/api/[^'"\`]+)['"\`]\\s*,\\s*(?:require\\(['"\`]\\./routes/${importName}['"\`]\\)|${importName})\\)`);
    const mountMatch = regexMount.exec(serverJs);
    
    if (!mountMatch) continue; // skip if not mounted
    const basePath = mountMatch[1];

    const regex = /router\.get\(['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(routeContent)) !== null) {
      const endpoint = match[1];
      // Skip endpoints requiring parameters for automated bulk testing
      if (!endpoint.includes(':')) {
        let fullUrl = basePath + (endpoint === '/' ? '' : endpoint);
        // clean up double slashes
        fullUrl = fullUrl.replace(/\/\//g, '/');
        routesToTest.push({
          page: `${routeBase} - ${endpoint}`,
          url: fullUrl,
          method: 'GET'
        });
      }
    }
  }
  return routesToTest;
}

async function runAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB for Real Audit');
  
  const token = await generateAdminToken();
  console.log('Generated auth token for testing.');

  const routes = discoverGetRoutes();
  console.log(`Discovered ${routes.length} GET routes without params.`);

  const report = [];

  for (const route of routes) {
    console.log(`Auditing: ${route.url}`);
    const startTime = process.hrtime();
    let responseTime = 0;
    
    try {
      const res = await axios({
        method: route.method,
        url: `${API_BASE}${route.url}`,
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true
      });

      const diff = process.hrtime(startTime);
      responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
      
      report.push({
        page: route.page,
        frontend: { lcp: "N/A", renderTime: "N/A" },
        backend: { responseTime: `${responseTime}ms`, status: res.status, route: route.url },
        database: { 
          query: "Check server logs for Mongoose queries",
          executionStats: { note: "Live data" }
        }
      });
      
    } catch (err) {
      console.error(`Failed ${route.url}:`, err.message);
    }
  }

  const reportPath = path.join(__dirname, 'real_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReal audit complete! Report saved to ${reportPath}`);
  
  process.exit(0);
}

runAudit().catch(console.error);
