const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const assetsPage = requirePageAccess('assets');

router.use(protect);
router.use(assetsPage);

router.get('/', assetController.getAssets);
router.post('/', assetController.createAsset);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
