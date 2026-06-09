/** Display helpers for Artist Path admin UI */

export const HIDDEN_ANSWER_KEYS = new Set([
  'name', 'email', 'phone', 'city',
  'instagram', 'spotify', 'youtube',
]);

export const LINK_ANSWER_KEYS = new Set(['instagram', 'spotify', 'youtube']);

export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', iconClass: 'text-pink-500' },
  { key: 'spotify', label: 'Spotify', iconClass: 'text-[#1DB954]' },
  { key: 'youtube', label: 'YouTube', iconClass: 'text-red-500' },
];

/** Ordered question groups — social links shown in profile header */
export const QUESTION_GROUPS = [
  {
    title: 'Artist identity',
    keys: ['artistIdentity'],
    fullWidth: true,
  },
  {
    title: 'Profile',
    keys: ['stageName', 'trainingDetails', 'coreSkills', 'strengthsUniqueness', 'dailyTime', 'mentorName'],
  },
  {
    title: 'Career & catalog',
    keys: ['songsReleased', 'showsPerformed', 'currentFans', 'currentSetup', 'currentlyWorkingOn', 'dailyRituals'],
  },
  {
    title: 'Goals & support',
    keys: ['learningNeeds', 'mentorshipNeeds', 'curationNeeds', 'fandomNeeds', 'aspirationalGoal'],
  },
  {
    title: 'Legacy fields',
    keys: [
      'artistType', 'primaryRole', 'learningGoal', 'learnedMusic', 'currentJourney',
      'fullTimeWillingness', 'qnaAnswered', 'attended', 'webinarDates', 'source',
    ],
  },
];

export function isLikelyEssayName(value) {
  if (!value || typeof value !== 'string') return false;
  const t = value.trim();
  return t.length > 55 || /^I (AM|WAS|'M)\b/i.test(t) || /^I WANT TO\b/i.test(t);
}

export function displayRespondentName({ name, email, stageName, latestArtistType } = {}) {
  const stage = stageName || latestArtistType;
  if (name && !isLikelyEssayName(name)) return name;
  if (stage && !isLikelyEssayName(stage)) return stage;
  if (email) {
    const local = email.split('@')[0]?.replace(/[._+]/g, ' ').trim();
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return 'Respondent';
}

export function displayStageBadge({ stageName, latestArtistType } = {}) {
  const stage = stageName || latestArtistType;
  if (!stage || isLikelyEssayName(stage)) return null;
  if (stage.length > 32) return null;
  return stage;
}

export function collectGroupedAnswers(answers = {}) {
  const used = new Set(HIDDEN_ANSWER_KEYS);
  const groups = [];

  for (const group of QUESTION_GROUPS) {
    const items = group.keys
      .filter((key) => answers[key] != null && answers[key] !== '')
      .map((key) => ({ key, value: String(answers[key]) }));
    items.forEach((i) => used.add(i.key));
    if (items.length) groups.push({ ...group, items });
  }

  const rest = Object.entries(answers)
    .filter(([key, val]) => val && !used.has(key))
    .map(([key, value]) => ({ key, value: String(value) }));
  if (rest.length) {
    groups.push({ title: 'Other', items: rest });
  }

  return groups;
}

export function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function normalizeSocialUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return isUrl(text) ? text : `https://${text.replace(/^\/\//, '')}`;
}

export function socialHandleFromUrl(platform, url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    if (platform === 'instagram') {
      const handle = path.split('/').filter(Boolean)[0];
      return handle ? `@${handle}` : u.hostname.replace(/^www\./, '');
    }
    if (platform === 'spotify') {
      const slug = path.split('/').filter(Boolean).pop();
      return slug ? slug.replace(/-/g, ' ') : 'Open profile';
    }
    if (platform === 'youtube') {
      const at = path.split('/').find((p) => p.startsWith('@'));
      if (at) return at;
      const channel = path.split('/').filter(Boolean).pop();
      return channel || 'Open channel';
    }
  } catch {
    /* ignore */
  }
  return 'Open profile';
}

export function collectSocialLinks(answers = {}) {
  return SOCIAL_PLATFORMS.map(({ key, label, iconClass }) => {
    const url = normalizeSocialUrl(answers[key]);
    if (!url) return null;
    return {
      key,
      label,
      iconClass,
      url,
      handle: socialHandleFromUrl(key, url),
    };
  }).filter(Boolean);
}
