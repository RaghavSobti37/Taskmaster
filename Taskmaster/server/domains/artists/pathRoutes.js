const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../middleware/authMiddleware');
const routes = require('./pathRoutes.handlers');

const artistPathAccess = requirePageAccess('admin_artist_path');

router.use(protect);

router.get('/people', artistPathAccess, routes.listPeople);
router.get('/people/:personId', artistPathAccess, routes.getPerson);
router.post('/sync', artistPathAccess, routes.sync);

module.exports = router;
