const express = require('express');
const spec = require('../openapi/spec.json');
const { config } = require('../config');

const router = express.Router();

router.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(spec);
});

if (config.NODE_ENV !== 'production') {
  router.get('/docs', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>CoreKnot API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });</script>
</body></html>`);
  });
}

module.exports = router;
