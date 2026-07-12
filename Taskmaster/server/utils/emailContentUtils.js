const UNSUBSCRIBE_START = '<!-- TASKMASTER_UNSUBSCRIBE_START -->';
const UNSUBSCRIBE_END = '<!-- TASKMASTER_UNSUBSCRIBE_END -->';

const stripUnsubscribe = (html) => {
  if (!html) return '';
  return html.replace(
    new RegExp(`${UNSUBSCRIBE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${UNSUBSCRIBE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    ''
  ).trimEnd();
};

module.exports = { stripUnsubscribe };
