const CARTOON_BASE =
  'https://cdn.jsdelivr.net/gh/Ashwinvalento/cartoon-avatar@master/lib/images';

const DICEBEAR_STYLES = [
  'adventurer',
  'avataaars',
  'big-smile',
  'bottts',
  'fun-emoji',
  'lorelei',
  'micah',
  'miniavs',
  'notionists',
  'open-peeps',
  'personas',
  'pixel-art',
  'thumbs',
  'shapes',
];

const getRandomAvatar = (gender = 'male') => {
  const useCartoon = Math.random() < 0.35;
  if (useCartoon) {
    const g = gender.toLowerCase() === 'female' ? 'female' : 'male';
    const id = Math.floor(Math.random() * 50) + 1;
    return `${CARTOON_BASE}/${g}/${id}.png`;
  }
  const style = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const seed = `${style}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

module.exports = { getRandomAvatar };
