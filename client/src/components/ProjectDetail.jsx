import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ClusterManager from './ClusterManager';
import TeamManager from './TeamManager';
import ProjectTaskAssignment from './ProjectTaskAssignment';
import './ProjectDetail.css';

const ProjectDetail = ({ project, onUpdate, onClose, apiUrl }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
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
        <button className="close-detail" onClick={onClose}>✕</button>
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
                <option value="team">Team Only</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="detail-description">
          <p>{project.description || 'No description added yet'}</p>
          {canEdit && (
            <button className="btn-edit" onClick={() => setIsEditing(true)}>
              Edit Project
            </button>
          )}
        </div>
      )}

      <div className="detail-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`tab-btn ${activeTab === 'clusters' ? 'active' : ''}`}
          onClick={() => setActiveTab('clusters')}
        >
          Clusters ({project.clusters?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          Team Members ({project.members?.length || 0})
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="info-grid">
              <div className="info-item">
                <label>Status</label>
                <div className="value">{project.status}</div>
              </div>
              <div className="info-item">
                <label>Visibility</label>
                <div className="value">{project.visibility}</div>
              </div>
              <div className="info-item">
                <label>Members</label>
                <div className="value">{project.members?.length || 0}</div>
              </div>
              <div className="info-item">
                <label>Clusters</label>
                <div className="value">{project.clusters?.length || 0}</div>
              </div>
            </div>

            {project.settings && (
              <div className="settings-section">
                <h3>Project Settings</h3>
                <ul>
                  <li>
                    Require approval: <strong>
                      {project.settings.requireApproval ? 'Yes' : 'No'}
                    </strong>
                  </li>
                  <li>
                    Allow task assignment: <strong>
                      {project.settings.allowAssignment ? 'Yes' : 'No'}
                    </strong>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <ProjectTaskAssignment
            project={project}
            canEdit={canEdit}
            onTaskCreated={onUpdate}
          />
        )}

        {activeTab === 'clusters' && (
          <ClusterManager
            project={project}
            onUpdate={onUpdate}
            canEdit={canEdit}
            apiUrl={apiUrl}
          />
        )}

        {activeTab === 'team' && (
          <TeamManager
            project={project}
            onUpdate={onUpdate}
            canEdit={canEdit}
            apiUrl={apiUrl}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
