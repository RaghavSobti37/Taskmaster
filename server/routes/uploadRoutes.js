import express from 'express';
import upload from '../config/multer.js';
import { uploadProfilePicture, deleteProfilePicture } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Upload profile picture
 * POST /api/upload/profile-picture
 * Body: multipart/form-data with 'profilePicture' field
 * Returns: { success: true, imageUrl: '/uploads/filename.webp', sizeKB: 45.23 }
 */
router.post('/profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);

/**
 * Delete profile picture
 * DELETE /api/upload/profile-picture/:filename
 * Params: filename (e.g., '1776195585792-raghav.webp')
 */
router.delete('/profile-picture/:filename', protect, deleteProfilePicture);

export default router;
