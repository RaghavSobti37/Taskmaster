const { dispatchEmailPayload } = require('../services/mailDriver');

async function sendSystemEmail({ to, cc, subject, html, text, from } = {}) {
  const body = html || (text ? `<p>${String(text).replace(/\n/g, '<br>')}</p>` : '');
  return dispatchEmailPayload({
    to: cc ? [to, cc].filter(Boolean).join(',') : to,
    subject,
    html: body,
    from,
  });
}

module.exports = { sendSystemEmail };
