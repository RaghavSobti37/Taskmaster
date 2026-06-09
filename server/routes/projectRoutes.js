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
const {
  getProjectGoals,
  updateProjectGoals,
  getProjectGoalsWeekly,
} = require('../controllers/projectGoalsController');
const {
  getProjectKra,
  getMyProjectKra,
  upsertProjectKra,
} = require('../controllers/projectKraController');
const { linkProjectCalendar, getProjectCalendarEvents } = require('../controllers/googleController');
const { protect } = require('../middleware/authMiddleware');
const { validateBody } = require('../validation/validateBody');
const {
  projectBody,
  createWorkspaceBody,
  reorderWorkspacesBody,
  workspaceUpdateBody,
  addMemberBody,
  updateMemberRoleBody,
  removeMemberBody,
  linkCalendarBody,
} = require('../validation/schemas/projects');

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
  .post(validateBody(projectBody), createProject)
  .get(getProjects);

router.route('/workspaces')
  .get(getWorkspaces)
  .post(validateBody(createWorkspaceBody), createWorkspace)
  .put(validateBody(reorderWorkspacesBody), reorderWorkspaces);

router.route('/workspaces/:name')
  .get(getWorkspaceByName)
  .patch(validateBody(workspaceUpdateBody), updateWorkspace)
  .delete(deleteWorkspace);

router.get('/analytics-summary', getProjectsAnalyticsSummary);

router.route('/:id')
  .get(getProjectById)
  .put(validateBody(projectBody), updateProject)
  .delete(deleteProject);

router.post('/:id/members', validateBody(addMemberBody), addMember);
router.patch('/:id/members/:userId/role', validateBody(updateMemberRoleBody), updateMemberRole);
router.put('/:id/remove-member', validateBody(removeMemberBody), removeMember);
router.get('/:id/workload', getProjectWorkload);
router.get('/:id/hours-summary', getProjectHoursSummary);
router.get('/:id/analytics', getProjectAnalytics);
router.get('/:id/goals', getProjectGoals);
router.put('/:id/goals', updateProjectGoals);
router.get('/:id/goals/weekly', getProjectGoalsWeekly);
router.get('/:id/kra', getProjectKra);
router.get('/:id/kra/me', getMyProjectKra);
router.put('/:id/kra/:userId', upsertProjectKra);

router.post('/:id/link-calendar', validateBody(linkCalendarBody), linkProjectCalendar);
router.get('/:id/calendar-events', getProjectCalendarEvents);

module.exports = router;
