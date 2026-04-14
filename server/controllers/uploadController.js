import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Upload and compress user profile picture
 * POST /api/upload/profile-picture
 * Requires: multipart/form-data with 'profilePicture' field
 * Returns: { success: true, imageUrl: '/uploads/filename.webp' }
 */
export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadDir = path.join(__dirname, '../public/uploads');
    const originalPath = req.file.path;
    
    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate optimized filename with webp extension
    const timestamp = Date.now();
    const username = req.user.username || 'user';
    const optimizedFilename = `${timestamp}-${username}.webp`;
    const optimizedPath = path.join(uploadDir, optimizedFilename);

    // Compress and convert to WebP format for better compression
    await sharp(originalPath)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(optimizedPath);

    // Delete the original file
    await fs.unlink(originalPath);

    // Get file size for logging
    const stats = await fs.stat(optimizedPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    const imageUrl = `/uploads/${optimizedFilename}`;
    
    res.json({
      success: true,
      imageUrl,
      sizeKB: parseFloat(sizeKB),
      message: `Profile picture uploaded and compressed to ${sizeKB} KB`
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload profile picture' });
  }
};

/**
 * Delete user profile picture
 * DELETE /api/upload/profile-picture/:filename
 */
export const deleteProfilePicture = async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: ensure filename doesn't contain path traversal
    if (filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, '../public/uploads', filename);
    
    // Verify the file exists before deleting
    await fs.access(filePath);
    await fs.unlink(filePath);

    res.json({ success: true, message: 'Profile picture deleted' });
  } catch (error) {
    console.error('Profile picture deletion error:', error);
    res.status(500).json({ error: 'Failed to delete profile picture' });
  }
};
