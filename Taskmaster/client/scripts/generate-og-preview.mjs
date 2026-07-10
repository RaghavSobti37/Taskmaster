/**
 * Social preview banner (1200×630) — logo mark + CoreKnot wordmark.
 * Run: node scripts/generate-og-preview.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const iconsDir = path.join(publicDir, 'icons');
const brandMarkPath = path.join(publicDir, 'brand-mark.svg');

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND_GREEN = '#126d5e';
const CREAM = '#fdf6f1';

const bannerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BRAND_GREEN}"/>
  <circle cx="1080" cy="120" r="180" fill="#ffffff" opacity="0.06"/>
  <circle cx="140" cy="520" r="220" fill="#ffffff" opacity="0.05"/>
  <text x="300" y="310" font-family="Segoe UI, system-ui, -apple-system, sans-serif" font-size="108" font-weight="700" fill="${CREAM}" letter-spacing="-2">CoreKnot</text>
  <text x="304" y="390" font-family="Segoe UI, system-ui, sans-serif" font-size="34" font-weight="500" fill="${CREAM}" opacity="0.88">Workspace Suite</text>
  <text x="304" y="450" font-family="Segoe UI, system-ui, sans-serif" font-size="22" fill="${CREAM}" opacity="0.7">Projects · CRM · Team ops in one place</text>
</svg>`;

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });

  const markSize = 200;
  const markPng = await sharp(fs.readFileSync(brandMarkPath))
    .resize(markSize, markSize)
    .png()
    .toBuffer();

  const basePng = await sharp(Buffer.from(bannerSvg)).png().toBuffer();

  const out = await sharp(basePng)
    .composite([{ input: markPng, left: 64, top: Math.round((HEIGHT - markSize) / 2) }])
    .png()
    .toBuffer();

  const dest = path.join(iconsDir, 'og-preview.png');
  fs.writeFileSync(dest, out);
  console.log(`Wrote icons/og-preview.png (${out.length} bytes, ${WIDTH}x${HEIGHT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
