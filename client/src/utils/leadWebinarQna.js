/** Client display helpers for webinar Q&A on CRM lead detail */

export function formatWebinarQnaDisplay(items = []) {
  if (!items?.length) return null;
  if (items.length === 1) return items[0].value;
  return items.map(({ label, value }) => (label ? `${label}\n${value}` : value)).join('\n\n');
}

export function hasArtistJourneyData(lead) {
  if (!lead) return false;
  return Boolean(
    lead.artistType
    || lead.fullTimeWillingness
    || lead.primaryRole
    || lead.learningGoal
    || lead.learnedMusic
    || lead.currentJourney
    || lead.qnaAnswered
    || lead.webinarQnaItems?.length
    || lead.artistPathResponses?.length
  );
}
