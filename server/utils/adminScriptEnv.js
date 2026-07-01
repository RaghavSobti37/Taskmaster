/** Env keys admin scripts may inherit — no API secrets, JWT, or cloud credentials. */
const ADMIN_SCRIPT_ENV_KEYS = [
  'NODE_ENV',
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'HOME',
  'USERPROFILE',
  'MONGODB_URI',
  'MONGODB_URI_PROD',
  'REDIS_URL',
  'FRONTEND_URL',
  'CLIENT_URL',
  'PORT',
];

function spawnEnvForAdminScript() {
  const env = {};
  for (const key of ADMIN_SCRIPT_ENV_KEYS) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

module.exports = { ADMIN_SCRIPT_ENV_KEYS, spawnEnvForAdminScript };
