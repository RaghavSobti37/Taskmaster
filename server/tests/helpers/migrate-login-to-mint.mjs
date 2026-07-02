import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.js') || f.endsWith('.integration.test.js'));

const importLine = "const { mintSessionAgent } = require('./helpers/mintTestSession');";
const loginBlockRe = /\n\s*const login(?:Res)? = await agent\.post\('\/api\/auth\/login'\)\.send\(\{[\s\S]*?\}\);\n\s*expect\(login(?:Res)?\.statusCode\)\.to(?:Be|Equal)\(200\);/g;

for (const f of files) {
  if (f === 'auth.test.js' || f === 'authMobileLogin.test.js' || f === 'mustChangePassword.test.js') {
    continue;
  }
  const filePath = path.join(testsDir, f);
  let s = fs.readFileSync(filePath, 'utf8');
  if (!s.includes("post('/api/auth/login')")) continue;
  if (!s.includes('mintTestSession')) {
    const marker = "require('../../shared/defaultPassword')";
    const idx = s.indexOf(marker);
    if (idx !== -1) {
      const end = s.indexOf(');', idx) + 2;
      s = `${s.slice(0, end)}\n${importLine}${s.slice(end)}`;
    } else {
      s = `${importLine}\n${s}`;
    }
  }
  const next = s.replace(loginBlockRe, '\n  await mintSessionAgent(agent, reg.body._id);');
  if (next !== s) {
    fs.writeFileSync(filePath, next);
    console.log('updated', f);
  }
}
