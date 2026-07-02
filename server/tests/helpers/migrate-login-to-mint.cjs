const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..');
const skip = new Set(['auth.test.js', 'authMobileLogin.test.js', 'mustChangePassword.test.js']);
const importLine = "const { mintSessionAgent } = require('./helpers/mintTestSession');";
const nl = '\\r?\\n';

const replacements = [
  new RegExp(`${nl}\\s*const login = await agent\\.post\\('/api/auth/login'\\)\\.send\\(\\{${nl}\\s*email,${nl}\\s*password: DEV_DEFAULT_PASSWORD,${nl}\\s*\\}\\);${nl}\\s*expect\\(login\\.statusCode\\)\\.toBe\\(200\\);`, 'g'),
  new RegExp(`${nl}\\s*const login = await agent\\.post\\('/api/auth/login'\\)\\.send\\(\\{ email, password: DEV_DEFAULT_PASSWORD \\}\\);${nl}\\s*expect\\(login\\.statusCode\\)\\.toBe\\(200\\);`, 'g'),
  new RegExp(`${nl}\\s*const login = await agent\\.post\\('/api/auth/login'\\)\\.send\\(\\{${nl}\\s*email: TEST_EMAIL,${nl}\\s*password: DEV_DEFAULT_PASSWORD,${nl}\\s*\\}\\);${nl}\\s*expect\\(login\\.statusCode\\)\\.toBe\\(200\\);`, 'g'),
  new RegExp(`${nl}\\s*const login = await agent\\.post\\('/api/auth/login'\\)\\.send\\(\\{${nl}\\s*email: \`tpl-\\$\\{stamp\\}@coreknot-test\\.local\`,${nl}\\s*password: DEV_DEFAULT_PASSWORD,${nl}\\s*\\}\\);${nl}\\s*expect\\(login\\.statusCode\\)\\.toBe\\(200\\);`, 'g'),
];

const rep = `${nl}  await mintSessionAgent(agent, reg.body._id);`;

for (const file of fs.readdirSync(testsDir)) {
  if (!file.endsWith('.test.js') || skip.has(file)) continue;
  const filePath = path.join(testsDir, file);
  let s = fs.readFileSync(filePath, 'utf8');
  if (!s.includes("post('/api/auth/login')")) continue;

  if (!s.includes('mintTestSession')) {
    const marker = "require('../../shared/defaultPassword')";
    const idx = s.indexOf(marker);
    if (idx !== -1) {
      const end = s.indexOf(');', idx) + 2;
      s = `${s.slice(0, end)}\r\n${importLine}${s.slice(end)}`;
    } else {
      s = `${importLine}\r\n${s}`;
    }
  }

  let changed = false;
  for (const re of replacements) {
    const next = s.replace(re, rep);
    if (next !== s) {
      s = next;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, s);
    console.log('updated', file);
  }
}
