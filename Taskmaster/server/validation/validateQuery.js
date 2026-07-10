const { INVALID_FORMAT } = require('./validateBody');

/**
 * Express middleware — parse req.query with a Zod schema.
 */
const validateQuery = (schema, { legacyFormatError = true } = {}) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (result.success) {
    req.query = result.data;
    return next();
  }
  if (legacyFormatError) {
    return res.status(400).json({ error: INVALID_FORMAT });
  }
  return res.status(400).json({
    error: 'Validation failed',
    issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
};

module.exports = {
  validateQuery,
};
