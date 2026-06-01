const fs = require('fs');
const path = require('path');
const modelsDir = 'c:\\\\Users\\\\ragha\\\\OneDrive\\\\Desktop\\\\Coreknot\\\\server\\\\models';

const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
let erDiagram = 'erDiagram\n';

for (const file of files) {
  const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
  const modelName = file.replace('.js', '');
  
  // Extract fields and types naively
  const fields = [];
  const refRegex = /([a-zA-Z0-9_]+):\s*{[^}]*type:[^}]*ref:\s*['"]([^'"]+)['"]/g;
  const simpleRegex = /([a-zA-Z0-9_]+):\s*{\s*type:\s*([a-zA-Z]+)/g;
  
  let match;
  // Relationships
  const refs = [];
  while ((match = refRegex.exec(content)) !== null) {
    const fieldName = match[1];
    const refName = match[2];
    refs.push({ field: fieldName, target: refName });
  }

  // Generate entity block
  erDiagram += `  ${modelName} {\n`;
  erDiagram += `    ObjectId _id PK\n`;
  // Just show a few important fields or count them to avoid massive diagrams?
  // Let's add basic fields
  let fieldMatches = [...content.matchAll(/([a-zA-Z0-9_]+):\s*{\s*type:\s*([a-zA-Z]+)/g)];
  // remove duplicates
  const seenFields = new Set();
  for (const fm of fieldMatches) {
    if (!seenFields.has(fm[1]) && fm[1] !== 'type') {
      erDiagram += `    ${fm[2]} ${fm[1]}\n`;
      seenFields.add(fm[1]);
    }
  }
  for (const ref of refs) {
    if (!seenFields.has(ref.field)) {
      erDiagram += `    ObjectId ${ref.field} FK\n`;
      seenFields.add(ref.field);
    }
  }
  erDiagram += `  }\n`;

  // Generate relationships
  for (const ref of refs) {
    erDiagram += `  ${modelName} ||--o{ ${ref.target} : "${ref.field}"\n`;
  }
}

fs.writeFileSync(path.join(process.cwd(), 'mermaid_er.txt'), erDiagram);
console.log("Done");
