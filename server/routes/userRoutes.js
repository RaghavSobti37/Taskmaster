const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

const { getTeam, updateProfile, getDirectory, updateUserRole, updateUserTeams, deleteUser } = require('../controllers/userController');

router.get('/team', protect, getTeam);
router.put('/profile', protect, updateProfile);
router.get('/directory', protect, admin, getDirectory);
router.put('/:id/role', protect, admin, updateUserRole);
router.put('/:id/teams', protect, admin, updateUserTeams);
router.delete('/:id', protect, admin, deleteUser);

module.exports = router;
