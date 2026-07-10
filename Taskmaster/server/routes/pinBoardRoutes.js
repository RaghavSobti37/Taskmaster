const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPins, createPin, updatePin, deletePin } = require('../controllers/pinBoardController');

router.use(protect);
router.get('/', getPins);
router.post('/', createPin);
router.put('/:id', updatePin);
router.delete('/:id', deletePin);

module.exports = router;
