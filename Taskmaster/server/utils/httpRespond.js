/** Safe JSON response — never throw ERR_HTTP_HEADERS_SENT after a timeout 503. */
function sendJson(res, statusCode, body) {
  if (!res || res.headersSent || res.writableEnded) return false;
  res.status(statusCode).json(body);
  return true;
}

module.exports = { sendJson };
