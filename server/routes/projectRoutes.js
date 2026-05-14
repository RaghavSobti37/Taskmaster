const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, updateProject, deleteProject, removeMember, addMember } = require('../controllers/projectController');
const { linkProjectCalendar, getProjectCalendarEvents } = require('../controllers/googleController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

router.post('/:id/members', addMember);
router.put('/:id/remove-member', removeMember);

router.post('/:id/link-calendar', linkProjectCalendar);
router.get('/:id/calendar-events', getProjectCalendarEvents);

module.exports = router;
