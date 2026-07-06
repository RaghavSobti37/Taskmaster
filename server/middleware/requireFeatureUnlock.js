const FEATURE_ROUTE_MAP = {
  resend: ['resend', 'emails'],
  finance: ['finance'],
  knowledgeEngine: ['knowledgeEngine', 'knowledge_engine'],
  artistOs: ['artistOs', 'artists'],
  google: ['google'],
  meta: ['meta'],
};

/** ponytail: paywalls removed — no-op middleware kept for route compatibility */
const requireFeatureUnlock = () => (req, res, next) => next();

module.exports = { requireFeatureUnlock, FEATURE_ROUTE_MAP };
