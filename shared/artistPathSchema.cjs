/**
 * Artist Path Google Sheet / HolySheet column mapping → normalized answer keys.
 * Live sheet (HolySheet API) uses questionnaire headers like FullName, ArtistIdentity, etc.
 */
const ARTIST_PATH_SHEET_ID = '1UQ6zbfazKUCg6tsWCLLIclpvQlWpPj4sugwCtfXmtxA';

/** Header → normalized key (identity, submittedAt, or answers.*) */
const COLUMN_MAP = {
  // HolySheet / Artist Path questionnaire (primary)
  Timestamp: 'submittedAt',
  FullName: 'name',
  StageName: 'stageName',
  Place: 'city',
  Mobile: 'phone',
  Email: 'email',
  Instagram: 'instagram',
  Spotify: 'spotify',
  Youtube: 'youtube',
  ArtistIdentity: 'artistIdentity',
  TrainingDetails: 'trainingDetails',
  CoreSkills: 'coreSkills',
  StrengthsUniqueness: 'strengthsUniqueness',
  DailyTime: 'dailyTime',
  MentorName: 'mentorName',
  SongsReleased: 'songsReleased',
  ShowsPerformed: 'showsPerformed',
  CurrentFans: 'currentFans',
  CurrentSetup: 'currentSetup',
  CurrentlyWorkingOn: 'currentlyWorkingOn',
  DailyRituals: 'dailyRituals',
  LearningNeeds: 'learningNeeds',
  MentorshipNeeds: 'mentorshipNeeds',
  CurationNeeds: 'curationNeeds',
  FandomNeeds: 'fandomNeeds',
  AspirationalGoal: 'aspirationalGoal',
  // Legacy / CSV aliases
  name: 'name',
  Name: 'name',
  email: 'email',
  phone: 'phone',
  Phone: 'phone',
  city: 'city',
  City: 'city',
  artistType: 'artistType',
  'Artist Type': 'artistType',
  primaryRole: 'primaryRole',
  'Primary Role': 'primaryRole',
  learningGoal: 'learningGoal',
  'Learning Goal': 'learningGoal',
  learnedMusic: 'learnedMusic',
  'Learned Music': 'learnedMusic',
  currentJourney: 'currentJourney',
  'Current Journey': 'currentJourney',
  fullTimeWillingness: 'fullTimeWillingness',
  'Full Time Willingness': 'fullTimeWillingness',
  qnaAnswered: 'qnaAnswered',
  'QnA Answered': 'qnaAnswered',
  attended: 'attended',
  Attended: 'attended',
  webinarDates: 'webinarDates',
  'Webinar Dates': 'webinarDates',
  source: 'source',
  Source: 'source',
  timestamp: 'submittedAt',
  'Submitted At': 'submittedAt',
  rowId: 'rowId',
};

const ANSWER_LABELS = {
  stageName: 'Stage name',
  artistIdentity: 'Artist identity',
  trainingDetails: 'Training details',
  coreSkills: 'Core skills',
  strengthsUniqueness: 'Strengths & uniqueness',
  dailyTime: 'Daily time on music',
  mentorName: 'Mentor name',
  songsReleased: 'Songs released',
  showsPerformed: 'Shows performed',
  currentFans: 'Current fans',
  currentSetup: 'Current setup',
  currentlyWorkingOn: 'Currently working on',
  dailyRituals: 'Daily rituals',
  learningNeeds: 'Learning needs',
  mentorshipNeeds: 'Mentorship needs',
  curationNeeds: 'Curation needs',
  fandomNeeds: 'Fandom needs',
  aspirationalGoal: 'Aspirational goal',
  instagram: 'Instagram',
  spotify: 'Spotify',
  youtube: 'YouTube',
  artistType: 'Artist type',
  primaryRole: 'Primary role',
  learningGoal: 'Learning goal',
  learnedMusic: 'Learned music',
  currentJourney: 'Current journey',
  fullTimeWillingness: 'Full-time willingness',
  qnaAnswered: 'Q&A completed',
  attended: 'Attended',
  webinarDates: 'Webinar dates',
  source: 'Source',
};

const IDENTITY_KEYS = new Set(['name', 'email', 'phone', 'city']);
const META_KEYS = new Set(['submittedAt', 'rowId']);

const ANSWER_KEYS = Object.keys(ANSWER_LABELS);

function normalizePhone(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
}

function parseSubmittedAt(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapRowToArtistPath(row = {}) {
  const answers = {};
  const identity = { name: '', email: '', phone: '', city: '' };
  let submittedAt = null;
  let rowId = '';
  const rawRow = { ...row };

  for (const [header, value] of Object.entries(row)) {
    if (value == null || value === '') continue;
    const trimmedHeader = String(header).trim();
    const key = COLUMN_MAP[trimmedHeader] || COLUMN_MAP[header];
    if (!key) continue;

    const strVal = String(value).trim();
    if (key === 'name') identity.name = strVal;
    else if (key === 'email') identity.email = strVal.toLowerCase();
    else if (key === 'phone') identity.phone = normalizePhone(strVal);
    else if (key === 'city') identity.city = strVal;
    else if (key === 'submittedAt') submittedAt = parseSubmittedAt(strVal);
    else if (key === 'rowId') rowId = strVal;
    else answers[key] = strVal;
  }

  if (!rowId) {
    rowId = [identity.email, identity.phone, submittedAt?.toISOString?.()].filter(Boolean).join('|') || '';
  }

  return { identity, answers, submittedAt, rowId, rawRow };
}

/** Display label for card badge — stage name or artist type */
function displayArtistLabel(answers = {}) {
  return answers.stageName || answers.artistType || '';
}

module.exports = {
  ARTIST_PATH_SHEET_ID,
  COLUMN_MAP,
  ANSWER_KEYS,
  ANSWER_LABELS,
  mapRowToArtistPath,
  displayArtistLabel,
};
