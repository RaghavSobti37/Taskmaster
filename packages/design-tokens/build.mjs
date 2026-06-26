import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf8'));

function flatten(obj, prefix = '') {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}-${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(...flatten(value, name));
    } else {
      const cssVar = `--${name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`;
      lines.push(`  ${cssVar}: ${value};`);
    }
  }
  return lines;
}

const css = `/* @coreknot/design-tokens — compiled from tokens.json */\n:root {\n${flatten(tokens).join('\n')}\n}\n`;

const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'tokens.css'), css);
console.log('Built design tokens → dist/tokens.css');
