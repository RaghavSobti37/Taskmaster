const INVALID_FORMAT = 'Invalid input format';

/**
 * Express middleware — parse req.body with a Zod schema.
 * Returns legacy `{ error: 'Invalid input format' }` for type/shape failures (auth tests).
 */
const validateBody = (schema, { legacyFormatError = true } = {}) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (result.success) {
    req.body = result.data;
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
  validateBody,
  INVALID_FORMAT,
};
