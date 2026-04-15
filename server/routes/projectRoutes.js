import express from 'express';
import {
  createProject,
  getUserProjects,
  getProject,
  updateProject,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  createCluster,
  addClusterMember,
  updateCluster,
  updateClusterMembers,
  deleteCluster,
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
router.put('/:projectId/members/:userId', protect, updateProjectMemberRole);
router.delete('/:projectId/members/:userId', protect, removeProjectMember);

// Cluster management
router.post('/:projectId/clusters', protect, createCluster);
router.put('/:projectId/clusters/:clusterId', protect, updateCluster);
router.delete('/:projectId/clusters/:clusterId', protect, deleteCluster);
router.post('/:projectId/clusters/:clusterId/members', protect, addClusterMember);
router.put('/:projectId/clusters/:clusterId/members', protect, updateClusterMembers);

export default router;
