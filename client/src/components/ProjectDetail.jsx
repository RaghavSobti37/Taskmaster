import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TeamManager from './TeamManager';
import './ProjectDetail.css';

const ProjectDetail = ({ project, onUpdate, onProjectChange, onClose }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: project.name,
    description: project.description,
    status: project.status,
    visibility: project.visibility
  });

  const isCreator = project.creator === user._id;
  const isAdmin = user?.role === 'admin' || user?.role === 'server_admin';
  const canEdit = isCreator || isAdmin;

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData({
      ...editData,
      [name]: value
    });
  };

  const handleSaveEdit = () => {
    onUpdate(project._id, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      name: project.name,
      description: project.description,
      status: project.status,
      visibility: project.visibility
    });
    setIsEditing(false);
  };

  return (
    <div className="project-detail">
      <div className="detail-header">
        <div className="detail-title">
          {isEditing ? (
            <input
              type="text"
              name="name"
              value={editData.name}
              onChange={handleEditChange}
              className="edit-title-input"
            />
          ) : (
            <h2>{project.name}</h2>
          )}
          <span className={`status-badge status-${project.status}`}>
            {project.status}
          </span>
        </div>
        <div className="detail-header-actions">
          {!isEditing && canEdit && (
            <button
              className="btn-edit btn-edit-icon"
              onClick={() => setIsEditing(true)}
              title="Edit project"
              aria-label="Edit project"
            >
              ✏️
            </button>
          )}
          <button className="close-detail" onClick={onClose}>✕</button>
        </div>
      </div>

      {isEditing && (
        <div className="edit-controls">
          <button className="btn-save" onClick={handleSaveEdit}>✓ Save</button>
          <button className="btn-cancel" onClick={handleCancel}>✕ Cancel</button>
        </div>
      )}

      {isEditing ? (
        <div className="edit-form">
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={editData.description}
              onChange={handleEditChange}
              placeholder="Add project description"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={editData.status} onChange={handleEditChange}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="planning">Planning</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Visibility</label>
              <select name="visibility" value={editData.visibility} onChange={handleEditChange}>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="detail-description">
          <p>{project.description || 'No description added yet'}</p>
        </div>
      )}

      <div className="detail-content">
        <TeamManager
          project={project}
          canEdit={canEdit}
          onProjectChange={onProjectChange}
        />
      </div>
    </div>
  );
};

export default ProjectDetail;
