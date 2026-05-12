const express = require('express');
const router = express.Router();
const { getTeams, createTeam, deleteTeam } = require('../controllers/teamController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', protect, getTeams);
router.post('/', protect, admin, createTeam);
router.delete('/:id', protect, admin, deleteTeam);

module.exports = router;
