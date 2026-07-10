/** HMAC signing secret for mail/unsubscribe tokens — never use a hardcoded production fallback. */
function getJwtSecretForHmac() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return secret;
}

module.exports = { getJwtSecretForHmac };
