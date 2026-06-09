const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const { getTeam, updateProfile, getDirectory, updateUserTeams, deleteUser, updateUserAdmin, createUserAdmin, getSalesReps, getArtistReps, getMonthlyReport } = require('../controllers/userController');

router.get('/team', protect, getTeam);
router.get('/sales-reps', protect, getSalesReps);
router.get('/artist-reps', protect, getArtistReps);
router.put('/profile', protect, updateProfile);
router.get('/directory', protect, getDirectory);
router.post('/', protect, admin, createUserAdmin);
router.put('/:id/teams', protect, admin, updateUserTeams);
router.get('/:id/monthly-report', protect, admin, getMonthlyReport);
router.put('/:id', protect, admin, updateUserAdmin);
router.delete('/:id', protect, admin, deleteUser);

module.exports = router;
