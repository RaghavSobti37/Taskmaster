import React, { useState } from 'react';
import api from '../services/api';
import './ProfilePictureUpload.css';

const ProfilePictureUpload = ({ onUploadSuccess, currentImageUrl, username }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await api.post('/upload/profile-picture', formData);
      
      setSuccess(`Uploaded! (${response.data.sizeKB} KB)`);
      setPreviewUrl(response.data.imageUrl);
      
      // Call the success callback
      if (onUploadSuccess) {
        onUploadSuccess(response.data.imageUrl);
      }

      // Clear preview after success
      setTimeout(() => {
        setPreviewUrl(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-picture-upload">
      <div className="upload-preview">
        {previewUrl || currentImageUrl ? (
          <img src={previewUrl || currentImageUrl} alt={username} className="preview-image" />
        ) : (
          <div className="preview-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        )}
      </div>

      <label className="upload-button">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="file-input"
        />
        {uploading ? (
          <span className="uploading-text">Uploading...</span>
        ) : (
          <span className="upload-text">Choose Image</span>
        )}
      </label>

      {error && <div className="upload-error">{error}</div>}
      {success && <div className="upload-success">{success}</div>}

      <p className="upload-hint">
        Max 5MB • JPG, PNG, WebP, GIF • 400x400px after resize
      </p>
    </div>
  );
};

export default ProfilePictureUpload;
