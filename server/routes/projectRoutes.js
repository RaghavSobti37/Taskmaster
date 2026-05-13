const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, updateProject, deleteProject, removeMember } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createProject)
  .get(getProjects);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

router.put('/:id/remove-member', removeMember);

module.exports = router;
