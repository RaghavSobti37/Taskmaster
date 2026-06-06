const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, admin } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `artist-path-${Date.now()}-${file.originalname}`),
  }),
});

const routes = require('./artistPathRoutes.handlers');
router.use(protect);

router.get('/people', admin, routes.listPeople);
router.get('/people/:personId', admin, routes.getPerson);
router.post('/sync', admin, routes.sync);
router.post('/upload', admin, upload.single('file'), routes.upload);

module.exports = router;
