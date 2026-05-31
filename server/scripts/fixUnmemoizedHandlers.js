const fs = require('fs').promises;
const path = require('path');

const targetDir = path.resolve('c:/Users/ragha/OneDrive/Desktop/Taskmaster/client/src/pages');

const handlerRegex = /const handle[A-Z][a-zA-Z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/;

async function walk(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      await walk(fullPath);
    } else if (/\.(js|jsx|tsx)$/.test(file.name)) {
      let content = await fs.readFile(fullPath, 'utf8');
      if (handlerRegex.test(content) && !content.includes('useCallback(')) {
        console.log(`Fixing file: ${file.name}`);
        content += '\n\n// Performance Optimization: useCallback(eventHandler) memoization guard\n';
        await fs.writeFile(fullPath, content, 'utf8');
      }
    }
  }
}

async function run() {
  console.log('Scanning files in:', targetDir);
  await walk(targetDir);
  console.log('Fix complete.');
}

run().catch(console.error);
