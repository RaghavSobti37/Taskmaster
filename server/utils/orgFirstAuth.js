/** Opt-in org-first session — Clerk active org required for JWT activeTenantId. */
const isOrgFirstAuthEnabled = () => (
  String(process.env.CLERK_ORG_FIRST_AUTH || '').trim().toLowerCase() === 'true'
);

module.exports = {
  isOrgFirstAuthEnabled,
};
