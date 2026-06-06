const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const routes = require('./artistPathRoutes.handlers');
router.use(protect);

router.get('/people', admin, routes.listPeople);
router.get('/people/:personId', admin, routes.getPerson);
router.post('/sync', admin, routes.sync);

module.exports = router;
