const { config } = require('../config');

function resolveSupabaseOrigin() {
  const raw = process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || '';
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function buildCspDirectives() {
  const supabaseOrigin = resolveSupabaseOrigin();

  const connectSrc = ["'self'", 'wss:'];
  if (supabaseOrigin) connectSrc.push(supabaseOrigin);

  if (config.isDevelopment) {
    connectSrc.push(
      'ws://localhost:*',
      'http://localhost:*',
      'ws://127.0.0.1:*',
      'http://127.0.0.1:*',
    );
  }

  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc,
  };
}

module.exports = { buildCspDirectives, resolveSupabaseOrigin };
