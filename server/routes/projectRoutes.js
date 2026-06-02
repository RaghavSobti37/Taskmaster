const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  removeMember,
  addMember,
  updateMemberRole,
  getWorkspaces,
  getWorkspaceByName,
  createWorkspace,
  updateWorkspace,
  reorderWorkspaces,
  deleteWorkspace,
  getProjectWorkload,
  getProjectHoursSummary,
  getProjectsAnalyticsSummary,
  getProjectAnalytics,
  exportWorkspacesPlainText,
} = require('../controllers/projectController');
const { linkProjectCalendar, getProjectCalendarEvents } = require('../controllers/googleController');
const { protect } = require('../middleware/authMiddleware');

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

router.get('/workspaces-plain.txt', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).end();
  }
  if (!LOCALHOST_IPS.has(req.ip)) {
    return res.status(403).type('text/plain').send('Localhost only\n');
  }
  return exportWorkspacesPlainText(req, res, next);
});

router.use(protect);

router.route('/')
  .post(createProject)
  .get(getProjects);

router.route('/workspaces')
  .get(getWorkspaces)
  .post(createWorkspace)
  .put(reorderWorkspaces);

router.route('/workspaces/:name')
  .get(getWorkspaceByName)
  .patch(updateWorkspace)
  .delete(deleteWorkspace);

router.get('/analytics-summary', getProjectsAnalyticsSummary);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

router.post('/:id/members', addMember);
router.patch('/:id/members/:userId/role', updateMemberRole);
router.put('/:id/remove-member', removeMember);
router.get('/:id/workload', getProjectWorkload);
router.get('/:id/hours-summary', getProjectHoursSummary);
router.get('/:id/analytics', getProjectAnalytics);

router.post('/:id/link-calendar', linkProjectCalendar);
router.get('/:id/calendar-events', getProjectCalendarEvents);

module.exports = router;
