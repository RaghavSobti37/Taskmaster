import React, { useState } from 'react';
import UserSearchModal from './UserSearchModal';
import api from '../services/api';
import './TeamManager.css';

const TeamManager = ({ project, onUpdate, canEdit, apiUrl }) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('member');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingRole, setEditingRole] = useState('member');

  const handleAddMembers = async (selectedUserIds) => {
    try {
      for (const userId of selectedUserIds) {
        const response = await api.post(`/projects/${project._id}/members`, {
          userId,
          role: selectedRole
        });
        // Update after each member added
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Refetch the project to get updated members
      const updatedProject = await api.get(`/projects/${project._id}`);
      onUpdate(project._id, updatedProject.data);
      setShowSearchModal(false);
      setSelectedRole('member');
    } catch (err) {
      console.error('Error adding member:', err);
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the project?')) return;

    try {
      const response = await api.delete(`/projects/${project._id}/members/${memberId}`);
      
      // Refetch the project to get updated members
      const updatedProject = await api.get(`/projects/${project._id}`);
      onUpdate(project._id, updatedProject.data);
    } catch (err) {
      console.error('Error removing member:', err);
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleUpdateRole = async (memberId, newRole) => {
    try {
      // Send update role request
      const response = await api.put(`/projects/${project._id}/members/${memberId}`, {
        role: newRole
      });
      
      // Refetch the project to get updated members
      const updatedProject = await api.get(`/projects/${project._id}`);
      onUpdate(project._id, updatedProject.data);
      setEditingMemberId(null);
    } catch (err) {
      console.error('Error updating role:', err);
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const getProjectMemberIds = () => {
    return project.members?.map(m => {
      // Handle both populated and unpopulated references
      return typeof m.userId === 'object' ? m.userId._id : m.userId;
    }) || [];
  };

  return (
    <div className="team-manager">
      {canEdit && (
        <button className="btn-add-member" onClick={() => setShowSearchModal(true)}>
          + Add Team Members
        </button>
      )}

      <UserSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectUsers={handleAddMembers}
        title="Add Members to Project"
        selectedUserIds={getProjectMemberIds()}
        allowMultiple={true}
      />

      <div className="role-selector-hint" style={{ marginBottom: '16px', display: showSearchModal ? 'none' : canEdit ? 'block' : 'none' }}>
        <label>Default Role for New Members:</label>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="role-select-input"
        >
          <option value="member">Member</option>
          <option value="lead">Lead</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {project.members && project.members.length > 0 ? (
        <div className="members-list">
          <div className="members-header">
            <h4>Team Members ({project.members.length})</h4>
          </div>
          {project.members.map(member => {
            // Handle both populated and unpopulated references
            const memberData = typeof member.userId === 'object' ? member.userId : member;
            const memberId = typeof member.userId === 'object' ? member.userId._id : member.userId;
            const role = member.role || 'member';

            return (
              <div key={memberId} className="member-card">
                <div className="member-card-left">
                  <div className="member-avatar-placeholder">
                    {(memberData.firstName || memberData.username)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-info">
                    <div className="member-name">
                      {memberData.firstName && memberData.lastName
                        ? `${memberData.firstName} ${memberData.lastName}`
                        : memberData.username}
                    </div>
                    <div className="member-email">{memberData.email}</div>
                  </div>
                </div>

                <div className="member-card-right">
                  {editingMemberId === memberId && canEdit ? (
                    <div className="role-editor">
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value)}
                        className="role-edit-select"
                      >
                        <option value="member">Member</option>
                        <option value="lead">Lead</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        className="btn-save-role"
                        onClick={() => handleUpdateRole(memberId, editingRole)}
                      >
                        ✓
                      </button>
                      <button
                        className="btn-cancel-role"
                        onClick={() => setEditingMemberId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`role-badge role-${role}`}
                        onClick={() => {
                          if (canEdit) {
                            setEditingMemberId(memberId);
                            setEditingRole(role);
                          }
                        }}
                        style={{ cursor: canEdit ? 'pointer' : 'default' }}
                      >
                        {role}
                        {canEdit && <span className="edit-hint">✎</span>}
                      </span>
                    </>
                  )}

                  {canEdit && (
                    <button
                      className="btn-remove-member"
                      onClick={() => handleRemoveMember(memberId)}
                      title="Remove member"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h4>No team members yet</h4>
          <p>Add your first member to start collaborating</p>
        </div>
      )}
    </div>
  );
};

export default TeamManager;
