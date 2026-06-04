/**
 * Universal brand icons from public/brand-mark.svg (Harmonic Frequency mark).
 * Run: npm run generate-icons  (also runs on prebuild)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const iconsDir = path.join(publicDir, 'icons');
const svgPath = path.join(publicDir, 'brand-mark.svg');
const manifestPath = path.join(publicDir, 'manifest.json');
const BRAND_GREEN = { r: 18, g: 109, b: 94, alpha: 1 };
const THEME_COLOR = '#126d5e';
const BRAND_MARK_SVG = '/brand-mark.svg';

/** filename → pixel size (square) */
const PNG_SIZES = {
  'favicon-16.png': 16,
  'favicon-32.png': 32,
  'favicon-48.png': 48,
  'apple-touch-icon-120.png': 120,
  'apple-touch-icon-152.png': 152,
  'apple-touch-icon-167.png': 167,
  'apple-touch-icon.png': 180,
  'icon-192.png': 192,
  'mstile-150x150.png': 150,
  'icon-512.png': 512,
  'og-image.png': 512,
};

const SAFARI_PINNED_TAB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M 32.0 18.0 Q 32.0 8.0 36.0 12.0 Q 32 32 32.0 18.0" fill="#000" stroke="#000" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 44.1 25.0 Q 49.3 18.0 53.3 22.0 Q 32 32 44.1 25.0" fill="#000" stroke="#000" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 44.1 39.0 Q 49.3 38.0 53.3 42.0 Q 32 32 44.1 39.0" fill="#000" stroke="#000" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 32.0 46.0 Q 32.0 48.0 36.0 52.0 Q 32 32 32.0 46.0" fill="#000" stroke="#000" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 19.9 39.0 Q 14.7 38.0 18.7 42.0 Q 32 32 19.9 39.0" fill="#000" stroke="#000" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 19.9 25.0 Q 14.7 18.0 18.7 22.0 Q 32 32 19.9 25.0" fill="#000" stroke="#000" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="2.2" fill="#000"/>
</svg>
`;

async function rasterize(svg, size, { padding = 0 } = {}) {
  const inner = Math.max(1, size - padding * 2);
  const mark = await sharp(svg).resize(inner, inner).png().toBuffer();
  if (padding === 0) return mark;
  return sharp(mark)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: BRAND_GREEN,
    })
    .png()
    .toBuffer();
}

function manifestIconEntry(src, sizes, purpose = 'any') {
  const entry = {
    src: `/icons/${src}`,
    sizes: `${sizes}x${sizes}`,
    type: 'image/png',
  };
  if (purpose) entry.purpose = purpose;
  return entry;
}

function buildManifestIcons() {
  return [
    manifestIconEntry('favicon-48.png', 48),
    manifestIconEntry('apple-touch-icon-120.png', 120),
    manifestIconEntry('apple-touch-icon-152.png', 152),
    manifestIconEntry('apple-touch-icon-167.png', 167),
    manifestIconEntry('apple-touch-icon.png', 180),
    manifestIconEntry('icon-192.png', 192),
    manifestIconEntry('mstile-150x150.png', 150),
    manifestIconEntry('icon-512.png', 512),
    manifestIconEntry('og-image.png', 512),
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: BRAND_MARK_SVG,
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any',
    },
  ];
}

const svg = fs.readFileSync(svgPath);
fs.mkdirSync(iconsDir, { recursive: true });

const written = {};

for (const [filename, size] of Object.entries(PNG_SIZES)) {
  const buffer = await rasterize(svg, size);
  const dest = path.join(iconsDir, filename);
  fs.writeFileSync(dest, buffer);
  written[filename] = buffer.length;
  console.log(`Wrote icons/${filename} (${buffer.length} bytes)`);
}

const maskable512 = await rasterize(svg, 512, { padding: Math.round(512 * 0.1) });
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), maskable512);
written['icon-maskable-512.png'] = maskable512.length;
console.log(`Wrote icons/icon-maskable-512.png (${maskable512.length} bytes)`);

const ico = await toIco([
  await rasterize(svg, 16),
  await rasterize(svg, 32),
  await rasterize(svg, 48),
]);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
console.log(`Wrote favicon.ico (${ico.length} bytes)`);

fs.copyFileSync(svgPath, path.join(publicDir, 'favicon.svg'));
console.log('Synced favicon.svg ← brand-mark.svg');

fs.writeFileSync(path.join(publicDir, 'safari-pinned-tab.svg'), SAFARI_PINNED_TAB_SVG.trim());
console.log('Wrote safari-pinned-tab.svg');

const catalog = {
  source: BRAND_MARK_SVG,
  themeColor: THEME_COLOR,
  generatedAt: new Date().toISOString(),
  files: Object.keys(written).sort(),
};
fs.writeFileSync(path.join(iconsDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.theme_color = THEME_COLOR;
manifest.icons = buildManifestIcons();
const shortcutIcon = { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' };
for (const shortcut of manifest.shortcuts || []) {
  shortcut.icons = [shortcutIcon];
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Updated manifest.json icons');

console.log('Done — universal icons from brand-mark.svg');
