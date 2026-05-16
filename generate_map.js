const fs = require('fs');
const path = require('path');

function getTree(dir, prefix = '') {
  let result = '';
  const files = fs.readdirSync(dir);
  files.forEach((file, index) => {
    // Skip node_modules and hidden folders
    if (file === 'node_modules' || file.startsWith('.')) return;

    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    const isLast = index === files.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    
    result += prefix + connector + file + '\n';
    
    if (stats.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += getTree(filePath, newPrefix);
    }
  });
  return result;
}

const root = process.cwd();
const dirsToMap = ['client/src', 'server', 'agentic_memory'];

let output = 'Taskmaster Repository Map\n\n';

dirsToMap.forEach(d => {
  const fullPath = path.join(root, d);
  if (fs.existsSync(fullPath)) {
    output += d + '\n';
    output += getTree(fullPath);
    output += '\n';
  }
});

fs.writeFileSync(path.join(root, 'agentic_memory', 'repo_map.txt'), output);
