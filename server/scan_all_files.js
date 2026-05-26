const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const dirs = fs.readdirSync(baseDir).filter(name => name.startsWith('Basecamp Download'));

const result = {};

function scan(dirPath, rootName) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      scan(fullPath, rootName);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        if (!result[rootName]) result[rootName] = [];
        result[rootName].push({
          name: item.name,
          path: fullPath,
          size: fs.statSync(fullPath).size
        });
      }
    }
  }
}

for (const d of dirs) {
  scan(path.join(baseDir, d), d);
}

fs.writeFileSync('basecamp_files.json', JSON.stringify(result, null, 2));
console.log('Saved basecamp_files.json');
Object.keys(result).forEach(k => {
  console.log(`- ${k}: ${result[k].length} files`);
});
