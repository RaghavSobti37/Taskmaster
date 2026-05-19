const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

const { getTeam, updateProfile, getDirectory, updateUserRole, updateUserTeams, deleteUser, updateUserAdmin, getSalesReps } = require('../controllers/userController');

router.get('/team', protect, getTeam);
router.get('/sales-reps', protect, getSalesReps);
router.put('/profile', protect, updateProfile);
router.get('/directory', protect, getDirectory);
router.put('/:id/role', protect, admin, updateUserRole);
router.put('/:id/teams', protect, admin, updateUserTeams);
router.put('/:id', protect, admin, updateUserAdmin);
router.delete('/:id', protect, admin, deleteUser);

module.exports = router;
