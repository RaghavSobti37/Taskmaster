import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swSource = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');

describe('service worker API caching', () => {
  it('does not register a cache strategy for authenticated API responses', () => {
    expect(swSource).not.toMatch(/api-read/);
    expect(swSource).not.toMatch(/NetworkFirst\(\{\s*cacheName:\s*`\$\{STATIC_CACHE\}-api-read`/s);
  });
});
