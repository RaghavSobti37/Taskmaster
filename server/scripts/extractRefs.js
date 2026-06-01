const fs = require('fs');
const path = require('path');
const modelsDir = 'c:\\\\Users\\\\ragha\\\\OneDrive\\\\Desktop\\\\Coreknot\\\\server\\\\models';
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
const connections = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
  const modelName = file.replace('.js', '');
  const refMatches = [...content.matchAll(/ref:\s*['"]([^'"]+)['"]/g)];
  for (const match of refMatches) {
    if (match[1] !== modelName) {
      connections.push(`  ${modelName} --> ${match[1]}`);
    }
  }
}

console.log('```mermaid');
console.log('graph TD;');
console.log([...new Set(connections)].join('\n'));
console.log('```');
