const { z } = require('zod');

const isSafePrimitive = (value) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');
  }
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
};

const isSafeShallowRecord = (value) => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && Object.values(value).every(isSafePrimitive)
);

module.exports = {
  isSafePrimitive,
  isSafeShallowRecord,
};
