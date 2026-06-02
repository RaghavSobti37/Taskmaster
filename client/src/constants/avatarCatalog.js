/**
 * Avatar picker catalog (650+ URLs).
 * Cartoons: Ashwinvalento (CC). DiceBear 9.x SVG: see https://www.dicebear.com/licenses
 *
 * Use SVG (not PNG) for DiceBear — the public PNG API is limited to ~10 req/s, so a 50-tile
 * picker grid gets HTTP 429 and shows broken images.
 */

const CARTOON_BASE =
  'https://cdn.jsdelivr.net/gh/Ashwinvalento/cartoon-avatar@master/lib/images';

const cartoonRange = (gender, count) =>
  Array.from(
    { length: count },
    (_, i) => `${CARTOON_BASE}/${gender}/${i + 1}.png`
  );

/** DiceBear SVG — unique seed per index yields stable distinct avatars. */
const dicebearRange = (style, count, prefix) =>
  Array.from(
    { length: count },
    (_, i) =>
      `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(`${prefix}-${i}`)}`
  );

/** Category id → avatar URL list */
export const AVATAR_CATALOG = {
  'Cartoon Male': cartoonRange('male', 50),
  'Cartoon Female': cartoonRange('female', 50),
  Adventure: dicebearRange('adventurer', 50, 'adventure'),
  Avataaars: dicebearRange('avataaars', 50, 'avataaars'),
  'Big Smile': dicebearRange('big-smile', 50, 'bigsmile'),
  Bots: dicebearRange('bottts', 50, 'bottts'),
  'Fun Emoji': dicebearRange('fun-emoji', 50, 'funemoji'),
  Lorelei: dicebearRange('lorelei', 50, 'lorelei'),
  Micah: dicebearRange('micah', 50, 'micah'),
  'Mini Avatars': dicebearRange('miniavs', 50, 'miniavs'),
  Notionists: dicebearRange('notionists', 50, 'notionists'),
  'Open Peeps': dicebearRange('open-peeps', 50, 'openpeeps'),
  Personas: dicebearRange('personas', 50, 'personas'),
  'Pixel Art': dicebearRange('pixel-art', 50, 'pixel'),
  Thumbs: dicebearRange('thumbs', 50, 'thumbs'),
  Shapes: dicebearRange('shapes', 50, 'shapes'),
};

export const AVATAR_CATEGORY_IDS = Object.keys(AVATAR_CATALOG);

export const AVATAR_TOTAL_COUNT = AVATAR_CATEGORY_IDS.reduce(
  (sum, id) => sum + (AVATAR_CATALOG[id]?.length || 0),
  0
);

/** Flat list for random default avatar selection */
export const ALL_AVATAR_URLS = AVATAR_CATEGORY_IDS.flatMap((id) => AVATAR_CATALOG[id]);

export function getRandomCatalogAvatar() {
  const idx = Math.floor(Math.random() * ALL_AVATAR_URLS.length);
  return ALL_AVATAR_URLS[idx];
}
