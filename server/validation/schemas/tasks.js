const { z } = require('zod');

const isSafeJsonValue = (value) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string' || typeof item === 'number');
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
};

const createTaskBody = z.record(z.unknown()).refine(
  (body) => Object.values(body).every(isSafeJsonValue),
  { message: 'Invalid input format' },
);

module.exports = {
  createTaskBody,
};
