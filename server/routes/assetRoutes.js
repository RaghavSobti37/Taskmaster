const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', assetController.getAssets);
router.post('/', assetController.createAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
