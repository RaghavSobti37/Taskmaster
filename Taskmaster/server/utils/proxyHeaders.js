/** Headers safe to forward from client to upstream proxy services. */
const PROXY_FORWARD_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-type',
  'user-agent',
  'x-request-id',
  'x-trace-id',
]);

const buildProxyRequestHeaders = (incoming = {}) => {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
  };

  for (const [key, value] of Object.entries(incoming)) {
    const lower = key.toLowerCase();
    if (!PROXY_FORWARD_HEADERS.has(lower)) continue;
    if (value === undefined || value === null) continue;
    headers[lower] = String(value);
  }

  return headers;
};

module.exports = {
  PROXY_FORWARD_HEADERS,
  buildProxyRequestHeaders,
};
