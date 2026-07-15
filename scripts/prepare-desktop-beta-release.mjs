import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const version = process.argv[2]?.trim();

if (!version || !/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)) {
  console.error('Usage: npm run release:desktop:beta -- <version>');
  console.error('Example: npm run release:desktop:beta -- 1.0.8-beta.2');
  process.exit(1);
}

const packageFiles = [
  'package.json',
  'Taskmaster/client/package.json',
  'Taskmaster/server/package.json',
  'Taskmaster/desktop/package.json',
];

async function updateJson(file, mutate) {
  const fullPath = path.join(root, file);
  const data = JSON.parse(await readFile(fullPath, 'utf8'));
  mutate(data);
  await writeFile(fullPath, `${JSON.stringify(data, null, 2)}\n`);
}

for (const file of packageFiles) {
  await updateJson(file, (data) => {
    data.version = version;
  });
}

await updateJson('Taskmaster/server/openapi/spec.json', (data) => {
  data.info = data.info || {};
  data.info.version = version;
});

console.log(`CoreKnot desktop beta version prepared: ${version}`);
console.log('Next: npm install && npm run desktop:smoke && npm run desktop:dist');
