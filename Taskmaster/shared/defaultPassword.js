/**
 * Local/dev default password for seeds, tests, and resetting weak accounts.
 * Override on the server with DEFAULT_SEED_PASSWORD in server/.env — never commit real prod secrets.
 */
const DEV_DEFAULT_PASSWORD = '1Million#';

module.exports = { DEV_DEFAULT_PASSWORD };
