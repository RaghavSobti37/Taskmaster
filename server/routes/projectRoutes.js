import express from 'express';
import {
  createProject,
  getUserProjects,
  getProject,
  updateProject,
  addProjectMember,
  removeProjectMember,
  createCluster,
  addClusterMember,
  deleteProject
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Project CRUD routes
router.post('/', protect, createProject);
router.get('/', protect, getUserProjects);
router.get('/:projectId', protect, getProject);
router.put('/:projectId', protect, updateProject);
router.delete('/:projectId', protect, deleteProject);

// Project member management
router.post('/:projectId/members', protect, addProjectMember);
router.delete('/:projectId/members/:userId', protect, removeProjectMember);

// Cluster management
router.post('/:projectId/clusters', protect, createCluster);
router.post('/:projectId/clusters/:clusterId/members', protect, addClusterMember);

export default router;
