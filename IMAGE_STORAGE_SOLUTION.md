# Image Storage Solution - Complete Migration Guide

## Overview

The application now uses **professional image upload and storage** instead of storing large base64 strings in MongoDB. This provides:

- ✅ **Reduced database size** - Images stored on disk, not in DB
- ✅ **Automatic compression** - Images converted to WebP at 80% quality
- ✅ **Automatic resizing** - All images resized to 400x400px
- ✅ **Better performance** - HTTP caching for static images
- ✅ **File size limits** - Max 5MB upload size (compressed to ~45KB)

## Technical Architecture

### Backend Components

#### 1. **Multer Configuration** (`server/config/multer.js`)
```javascript
- Handles multipart/form-data uploads
- File type validation (image/jpeg, image/png, image/webp, image/gif)
- 5MB size limit
- Stores files in server/public/uploads/
```

#### 2. **Upload Controller** (`server/controllers/uploadController.js`)
```javascript
uploadProfilePicture(req, res)
  - Accepts multipart/form-data with 'profilePicture' field
  - Compresses using Sharp (WebP, 80% quality, 400x400px)
  - Returns: { imageUrl: '/uploads/timestamp-username.webp', sizeKB: 45.23 }
  - Deletes original file after compression

deleteProfilePicture(req, res)
  - Deletes uploaded image file
  - Requires filename parameter
  - Path traversal protection included
```

#### 3. **Upload Routes** (`server/routes/uploadRoutes.js`)
```
POST /api/upload/profile-picture
  - Protected: Requires JWT token
  - Body: multipart/form-data with 'profilePicture' field
  - Returns: { success, imageUrl, sizeKB, message }

DELETE /api/upload/profile-picture/:filename
  - Protected: Requires JWT token
  - Params: filename (e.g., '1776195585792-raghav.webp')
```

#### 4. **User Model Update** (`server/models/User.js`)
```javascript
profilePicture: String  // Deprecated (kept for backward compatibility)
profilePictureUrl: String  // New: Stores image URL
```

#### 5. **Auth Controller Updates** (`server/controllers/authController.js`)
- Register endpoint: Returns both `profilePicture` and `profilePictureUrl`
- Login endpoint: Returns both `profilePicture` and `profilePictureUrl`
- Ensures backward compatibility with existing clients

#### 6. **Static File Serving** (`server/server.js`)
```javascript
app.use('/uploads', express.static('public/uploads'));
// Images accessible at: http://localhost:5000/uploads/filename.webp
```

### Frontend Components

#### 1. **ProfilePictureUpload Component** (`client/src/components/ProfilePictureUpload.jsx`)
```jsx
<ProfilePictureUpload 
  onUploadSuccess={(imageUrl) => handleSuccess(imageUrl)}
  currentImageUrl={user.profilePictureUrl}
  username={user.username}
/>
```

Features:
- Image preview before upload
- File validation (type and size)
- Upload progress feedback
- Success/error messages
- Responsive design

#### 2. **ProfileDropdown Updates** (`client/src/components/ProfileDropdown.jsx`)
```javascript
- Prefers profilePictureUrl over profilePicture
- Handles relative paths: converts to full API URL
- Fallback to initials if image fails to load
- Backward compatible with base64 images
```

#### 3. **ProfileAvatar Updates** (`client/src/components/ProfileAvatar.jsx`)
```javascript
- Props: profilePictureUrl, profilePicture
- Automatically uses API base URL for relative paths
- Fallback to initial letter if image fails
- Error handling with console feedback
```

#### 4. **Navbar Updates** (`client/src/components/Navbar.jsx`)
```javascript
<ProfileAvatar 
  username={user.username}
  profilePicture={user.profilePicture}
  profilePictureUrl={user.profilePictureUrl}
/>
```

## Usage Workflow

### For Users (Frontend)

1. **Upload Profile Picture**
```jsx
import ProfilePictureUpload from './components/ProfilePictureUpload';

<ProfilePictureUpload 
  onUploadSuccess={(url) => {
    // Update user context
    setUser({...user, profilePictureUrl: url});
  }}
  currentImageUrl={user.profilePictureUrl}
  username={user.username}
/>
```

2. **Image appears automatically** in:
   - Navbar avatar
   - Profile dropdown
   - Team member cards
   - Admin user list

3. **Supported formats**: JPG, PNG, WebP, GIF
4. **Max size**: 5MB (automatically compressed to ~45KB)
5. **After upload**: 400x400px, WebP format

### For Developers (Backend)

1. **Upload Handler**
```bash
POST /api/upload/profile-picture
Authorization: Bearer {token}
Content-Type: multipart/form-data

profilePicture: [image file]
```

2. **Response**
```json
{
  "success": true,
  "imageUrl": "/uploads/1776195585792-raghav.webp",
  "sizeKB": 45.23,
  "message": "Uploaded! (45.23 KB)"
}
```

3. **Update user profile**
```javascript
// In your backend
await User.findByIdAndUpdate(userId, {
  profilePictureUrl: '/uploads/1776195585792-raghav.webp'
});
```

## Image URLs in Different Environments

### Development
```
Frontend uploads to: http://localhost:5000/api/upload/profile-picture
Image URL returned: /uploads/timestamp-username.webp
Frontend displays: http://localhost:5000/uploads/timestamp-username.webp
```

### Production (Vercel + Render)
```
Frontend uploads to: https://taskmaster-jfw0.onrender.com/api/upload/profile-picture
Image URL returned: /uploads/timestamp-username.webp
Frontend displays: https://taskmaster-jfw0.onrender.com/uploads/timestamp-username.webp
```

## File Structure

```
server/
├── public/
│   └── uploads/              # Image storage (created automatically)
│       ├── 1776195585792-raghav.webp
│       ├── 1776195585793-user.webp
│       └── ...
├── config/
│   └── multer.js            # File upload configuration
├── controllers/
│   └── uploadController.js  # Image upload/delete logic
├── routes/
│   └── uploadRoutes.js      # Upload endpoints
└── server.js                # Static file serving configured
```

## Migration from Base64 to URLs

### For Existing Users

Old format (still supported):
```javascript
user.profilePicture = 'data:image/jpeg;base64,...'
```

New format:
```javascript
user.profilePictureUrl = '/uploads/1776195585792-raghav.webp'
```

### Priority in Code

1. Check `profilePictureUrl` first
2. Fallback to `profilePicture` if URL is base64
3. Fallback to initials if no image

```javascript
const getImageUrl = () => {
  if (user.profilePictureUrl) return buildFullUrl(user.profilePictureUrl);
  if (user.profilePicture?.startsWith('data:')) return user.profilePicture;
  return null;
};
```

## Database Optimization

### Before (Base64 Storage)
```
MongoDB Document Size: ~90KB-150KB per user image
Storage: 1MB per ~7-10 users
```

### After (URL Storage)
```
MongoDB Document Size: ~500 bytes per user (just the URL)
Storage: 1MB per ~2000 users (1800x smaller!)
Image Files: Stored on server disk (45KB per image)
```

## API Endpoints Summary

| Method | Endpoint | Auth | Body | Returns |
|--------|----------|------|------|---------|
| POST | `/api/upload/profile-picture` | ✅ | multipart/form-data | imageUrl |
| DELETE | `/api/upload/profile-picture/:filename` | ✅ | - | success message |
| GET | `/uploads/:filename` | ❌ | - | Image file |

## Testing

### Test Upload
```bash
curl -X POST http://localhost:5000/api/upload/profile-picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "profilePicture=@/path/to/image.jpg"
```

### Expected Response
```json
{
  "success": true,
  "imageUrl": "/uploads/1776195585792-username.webp",
  "sizeKB": 43.15,
  "message": "Uploaded! (43.15 KB)"
}
```

## Troubleshooting

### Upload fails with 413
**Problem**: File too large
**Solution**: Max size is 5MB. Compress your image before upload.

### Image appears as broken link
**Problem**: API URL not properly constructed
**Solution**: Ensure VITE_API_URL env var is set correctly
```javascript
// Frontend automatically adds: ${VITE_API_URL}${imageUrl}
// Example: "http://localhost:5000" + "/uploads/file.webp"
```

### Image not showing in production
**Problem**: Render server needs public/uploads directory
**Solution**: Directory is created automatically on first upload.

## Dependencies

**Backend**: 
- `multer` - Form data parsing
- `sharp` - Image compression/resizing

**Frontend**:
- Built-in `fetch` API
- No additional dependencies

## Future Enhancements

1. **AWS S3 Integration** - Store on cloud CDN
2. **Image Cropping Tool** - Let users crop before upload
3. **Multiple Images** - Support gallery
4. **Drag & Drop** - Improved UX
5. **Image Optimization** - AVIF format support
