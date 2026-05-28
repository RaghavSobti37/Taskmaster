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
  getWorkspaces,
  createWorkspace,
  reorderWorkspaces,
  deleteWorkspace,
} = require('../controllers/projectController');
const { linkProjectCalendar, getProjectCalendarEvents } = require('../controllers/googleController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createProject)
  .get(getProjects);

router.route('/workspaces')
  .get(getWorkspaces)
  .post(createWorkspace)
  .put(reorderWorkspaces);

router.route('/workspaces/:name')
  .delete(deleteWorkspace);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

router.post('/:id/members', addMember);
router.put('/:id/remove-member', removeMember);

router.post('/:id/link-calendar', linkProjectCalendar);
router.get('/:id/calendar-events', getProjectCalendarEvents);

module.exports = router;
