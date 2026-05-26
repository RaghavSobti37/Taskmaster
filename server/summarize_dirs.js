const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const dirs = fs.readdirSync(baseDir).filter(name => name.startsWith('Basecamp Download'));

dirs.forEach(d => {
  const fullPath = path.join(baseDir, d);
  console.log(`\nDirectory: ${d}`);
  const items = fs.readdirSync(fullPath, { withFileTypes: true });
  items.forEach(item => {
    if (item.isDirectory()) {
      console.log(`  [DIR] ${item.name}`);
      // Show sub-directories of this
      const subPath = path.join(fullPath, item.name);
      try {
        const subItems = fs.readdirSync(subPath, { withFileTypes: true });
        subItems.forEach(subItem => {
          if (subItem.isDirectory()) {
            console.log(`    [SUB-DIR] ${subItem.name}`);
          }
        });
      } catch {}
    } else {
      console.log(`  [FILE] ${item.name}`);
    }
  });
});
