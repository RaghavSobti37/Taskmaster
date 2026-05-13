const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artistController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', artistController.getArtists);
router.get('/:id', artistController.getArtistById);
router.post('/', artistController.createArtist);
router.put('/:id', artistController.updateArtist);
router.delete('/:id', artistController.deleteArtist);
router.post('/:id/inject-event', artistController.injectEvent);
router.post('/:id/sync-stats', artistController.syncArtistStats);

module.exports = router;
