/**
 * Extract readable webinar Q&A from Lead.qnaAnswered and import metadata.
 */

const YES_NO_ONLY = /^(y|yes|n|no|maybe|not sure|true|false|pending|—|-)$/i;

const QNA_META_KEY = /^(q\s*&?\s*a|qna|question|poll|survey|webinar\s*q)/i;

const JOURNEY_META_SKIP = new Set([
  'artistType', 'primaryRole', 'learningGoal', 'learnedMusic', 'currentJourney',
  'fullTimeWillingness', 'webinarDates', 'attended', 'attendanceDurationMin', 'source',
  'rowId', 'customerIdExly', 'transactionIdExly', 'importRowKey', 'publication',
]);

function isYesNoFlag(value) {
  return YES_NO_ONLY.test(String(value || '').trim());
}

function formatQnaText(value) {
  const text = String(value || '').trim();
  if (!text || isYesNoFlag(text)) return null;
  return text;
}

function extractMetadataQna(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return [];

  const items = [];
  const entries = Object.entries(metadata).filter(([, v]) => v != null && String(v).trim());

  for (const [key, val] of entries) {
    const label = String(key).trim();
    if (JOURNEY_META_SKIP.has(label)) continue;
    if (!QNA_META_KEY.test(label) && !/^qna answered$/i.test(label)) continue;
    const formatted = formatQnaText(val);
    if (formatted) items.push({ label, value: formatted });
  }

  const questionEntries = entries
    .filter(([k]) => /^question\s*\d+/i.test(String(k).trim()) || /^q\s*\d+\b/i.test(String(k).trim()))
    .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true }));

  for (const [qKey, qVal] of questionEntries) {
    const qText = formatQnaText(qVal);
    if (!qText) continue;
    const numMatch = String(qKey).match(/(\d+)/);
    const num = numMatch ? numMatch[1] : '';
    const answerKey = entries.find(([k]) => {
      const kl = String(k).trim().toLowerCase();
      return num && (kl === `answer ${num}` || kl === `a${num}` || kl === `response ${num}`);
    });
    const answerText = answerKey ? formatQnaText(answerKey[1]) : null;
    items.push({
      label: num ? `Question ${num}` : qKey,
      value: answerText ? `${qText}\n\n→ ${answerText}` : qText,
    });
  }

  return items;
}

function buildWebinarQnaItems(lead = {}) {
  const items = [];
  const seen = new Set();

  const fromField = formatQnaText(lead.qnaAnswered);
  if (fromField) {
    items.push({ label: 'Webinar Q&A', value: fromField });
    seen.add(fromField);
  }

  for (const item of extractMetadataQna(lead.metadata)) {
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    items.push(item);
  }

  return items;
}

module.exports = {
  buildWebinarQnaItems,
  formatQnaText,
  isYesNoFlag,
};
