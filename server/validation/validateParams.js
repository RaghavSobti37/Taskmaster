const INVALID_FORMAT = 'Invalid input format';

const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (result.success) {
    req.params = result.data;
    return next();
  }
  return res.status(400).json({ error: INVALID_FORMAT });
};

module.exports = { validateParams };
