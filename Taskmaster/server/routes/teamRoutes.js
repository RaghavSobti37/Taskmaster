const express = require('express');
const router = express.Router();
const { getTeams, createTeam, deleteTeam } = require('../controllers/teamController');
const { protect, requireAnyPageAccess } = require('../middleware/authMiddleware');

const teamsAccess = requireAnyPageAccess('admin_users', 'admin_teams');

router.get('/', protect, teamsAccess, getTeams);
router.post('/', protect, teamsAccess, createTeam);
router.delete('/:id', protect, teamsAccess, deleteTeam);

module.exports = router;
