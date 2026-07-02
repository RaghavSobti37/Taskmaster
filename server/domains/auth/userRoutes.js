const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../../middleware/authMiddleware');

const usersAdminAccess = requirePageAccess('admin_users');
const {
  getTeam,
  updateProfile,
  getDirectory,
  updateUserTeams,
  deleteUser,
  updateUserAdmin,
  createUserAdmin,
  getSalesReps,
  getArtistReps,
  getMonthlyReport,
} = require('./controllers/userController');
const { adminRevokeAllUserSessions } = require('./controllers/authController');
const { auditSensitiveMutation } = require('../../services/securityAuditService');

router.get('/team', protect, getTeam);
router.get('/sales-reps', protect, getSalesReps);
router.get('/artist-reps', protect, getArtistReps);
router.put('/profile', protect, updateProfile);
router.get('/directory', protect, getDirectory);
router.post('/', protect, usersAdminAccess, auditSensitiveMutation({ resourceType: 'User', action: 'CREATE' }), createUserAdmin);
router.post('/:id/sessions/revoke-all', protect, usersAdminAccess, auditSensitiveMutation({ resourceType: 'User', action: 'REVOKE_SESSIONS' }), adminRevokeAllUserSessions);
router.put('/:id/teams', protect, usersAdminAccess, updateUserTeams);
router.get('/:id/monthly-report', protect, usersAdminAccess, getMonthlyReport);
router.put('/:id', protect, usersAdminAccess, auditSensitiveMutation({ resourceType: 'User', action: 'UPDATE' }), updateUserAdmin);
router.delete('/:id', protect, usersAdminAccess, auditSensitiveMutation({ resourceType: 'User', action: 'DELETE' }), deleteUser);

module.exports = router;
