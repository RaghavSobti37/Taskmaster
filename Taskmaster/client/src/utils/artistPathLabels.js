/** Client mirror of shared/artistPathSchema ANSWER_LABELS — keep in sync */
export const ANSWER_LABELS = {
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
  anythingElse: 'Anything else',
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

export function answerLabel(key) {
  return ANSWER_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}
