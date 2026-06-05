const express = require('express');
const spec = require('../openapi/spec.json');

const router = express.Router();

router.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(spec);
});

module.exports = router;
