/** Deploy identity for /api/health — ponytail: Render/Vercel already expose these env vars. */
function getBuildMeta() {
  const fullSha = (
    process.env.RENDER_GIT_COMMIT
    || process.env.VERCEL_GIT_COMMIT_SHA
    || ''
  ).trim();

  return {
    commitSha: fullSha ? fullSha.slice(0, 12) : null,
    deployTier: (process.env.COREKNOT_DEPLOY_TIER || process.env.DD_ENV || '').trim() || null,
    service: (process.env.RENDER_SERVICE_NAME || '').trim() || null,
  };
}

module.exports = { getBuildMeta };
