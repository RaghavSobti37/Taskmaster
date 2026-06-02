const IST = 'Asia/Kolkata';

function formatIstFollowupDate(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  return `${day}-${month}-${year}`;
}

/** 24-hour HH:mm for CRM reminder parser */
function formatIstFollowupTime24(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .trim();
}

module.exports = {
  formatIstFollowupDate,
  formatIstFollowupTime24,
};
