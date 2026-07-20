const { assertEmailDispatchSucceeded, dispatchEmailPayload } = require('../services/mailDriver');
const { textToHtml } = require('./emailHtml');

async function sendSystemEmail({ to, cc, subject, html, text, from } = {}) {
  const body = html || (text ? `<p>${textToHtml(text)}</p>` : '');
  const result = await dispatchEmailPayload({
    to: cc ? [to, cc].filter(Boolean).join(',') : to,
    subject,
    html: body,
    from,
  });
  return assertEmailDispatchSucceeded(result, 'System email dispatch failed');
}

module.exports = { sendSystemEmail };
