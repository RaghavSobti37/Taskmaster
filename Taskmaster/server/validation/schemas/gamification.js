const { z } = require('zod');

const gamificationConfigBody = z.record(z.unknown()).refine(
  (body) => Object.values(body).every((value) => typeof value === 'number' && value >= 0),
  { message: 'Invalid input format' },
);

module.exports = {
  gamificationConfigBody,
};
