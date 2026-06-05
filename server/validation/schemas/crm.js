const { z } = require('zod');

const isSafeLeadValue = (value) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');
  }
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
};

const leadBody = z.record(z.unknown()).refine(
  (body) => Object.values(body).every(isSafeLeadValue),
  { message: 'Invalid input format' },
);

const leadNoteBody = z.object({
  text: z.string().min(1),
});

const leadIdParams = z.object({
  id: z.string().min(1),
});

module.exports = {
  createLeadBody: leadBody,
  updateLeadBody: leadBody,
  leadNoteBody,
  leadIdParams,
};
