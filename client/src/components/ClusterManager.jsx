import React, { useState, useEffect } from 'react';
import api from '../services/api';
import UserSearchModal from './UserSearchModal';
import './ClusterManager.css';

const ClusterManager = ({ project, onProjectChange, canEdit }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClusterId, setEditingClusterId] = useState(null);
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterDescription, setNewClusterDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const getUserId = (userLike) => {
    if (!userLike) return '';
    if (typeof userLike === 'string') return userLike;
    if (typeof userLike.userId === 'string') return userLike.userId;
    if (typeof userLike.userId === 'object' && userLike.userId?._id) return userLike.userId._id;
    return userLike._id || '';
  };

  const getDisplayName = (userLike) => {
    if (!userLike) return 'User';

    const base = typeof userLike.userId === 'object' ? userLike.userId : userLike;
    const fullName = `${base?.firstName || ''} ${base?.lastName || ''}`.trim();

    return fullName || base?.username || base?.email || 'User';
  };

  const normalizeProjectMember = (member) => {
    if (!member) return null;

    if (typeof member === 'string') {
      return {
        _id: member,
        displayName: 'User',
        email: '',
        role: 'member'
      };
    }

    const userData = typeof member.userId === 'object' ? member.userId : member;
    const id = getUserId(member);

    return {
      _id: id,
      displayName: getDisplayName(member),
      email: userData?.email || '',
      role: member.role || userData?.role || 'member'
    };
  };

  const getClusterMemberIds = (members = []) => {
    return members
      .map(member => getUserId(member))
      .filter(Boolean);
  };

  // Fetch available users for project
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get(`/projects/${project._id}`);
        const members = response.data.members || [];
        const normalizedMembers = members
          .map(normalizeProjectMember)
          .filter(Boolean)
          .filter(member => !!member._id);

        setAvailableUsers(normalizedMembers);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    if (canEdit) {
      fetchUsers();
    }
  }, [project._id, canEdit]);

  const handleCreateCluster = async (e) => {
    e.preventDefault();

    if (!newClusterName.trim()) {
      alert('Cluster name is required');
      return;
    }

    try {
      setLoading(true);
      
      // Create cluster first
      await api.post(`/projects/${project._id}/clusters`, {
        name: newClusterName,
        description: newClusterDescription,
        members: selectedMembers
      });

      // Fetch updated project
      const updatedProject = await api.get(`/projects/${project._id}`);
      onProjectChange(updatedProject.data);

      // Reset form
      setNewClusterName('');
      setNewClusterDescription('');
      setSelectedMembers([]);
      setShowCreateForm(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCluster = (cluster) => {
    setEditingClusterId(cluster._id);
    setNewClusterName(cluster.name);
    setNewClusterDescription(cluster.description || '');
    setSelectedMembers(getClusterMemberIds(cluster.members));
  };

  const handleSaveEdit = async () => {
    if (!newClusterName.trim()) {
      alert('Cluster name is required');
      return;
    }

    try {
      setLoading(true);

      await api.put(`/projects/${project._id}/clusters/${editingClusterId}`, {
        name: newClusterName,
        description: newClusterDescription
      });

      await api.put(`/projects/${project._id}/clusters/${editingClusterId}/members`, {
        memberIds: selectedMembers
      });

      const updatedProject = await api.get(`/projects/${project._id}`);
      onProjectChange(updatedProject.data);

      setEditingClusterId(null);
      setNewClusterName('');
      setNewClusterDescription('');
      setSelectedMembers([]);
    } catch (err) {
      alert(`Error updating cluster: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCluster = async (clusterId) => {
    if (!window.confirm('Delete this cluster and all its members?')) return;

    try {
      await api.delete(`/projects/${project._id}/clusters/${clusterId}`);
      const updatedProject = await api.get(`/projects/${project._id}`);
      onProjectChange(updatedProject.data);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSelectMembersFromModal = (selectedUserIds) => {
    const validSelectedIds = selectedUserIds.filter(userId =>
      availableUsers.some(user => user._id === userId)
    );

    setSelectedMembers(validSelectedIds);
    setShowMemberModal(false);
  };

  const handleCancelEdit = () => {
    setEditingClusterId(null);
    setNewClusterName('');
    setNewClusterDescription('');
    setSelectedMembers([]);
    if (!editingClusterId) {
      setShowCreateForm(false);
    }
  };

  return (
    <div className="cluster-manager">
      {canEdit && !showCreateForm && editingClusterId === null && (
        <button className="btn-add-cluster" onClick={() => setShowCreateForm(true)}>
          + Add Cluster
        </button>
      )}

      {(showCreateForm || editingClusterId) && (
        <div className="cluster-form-container">
          <UserSearchModal
            isOpen={showMemberModal}
            onClose={() => setShowMemberModal(false)}
            onSelectUsers={handleSelectMembersFromModal}
            title={editingClusterId ? 'Edit Cluster Members' : 'Add Members to Cluster'}
            selectedUserIds={selectedMembers}
            allowMultiple={true}
            allowedUserIds={availableUsers.map(user => user._id)}
          />

          <form onSubmit={editingClusterId ? (e) => { e.preventDefault(); handleSaveEdit(); } : handleCreateCluster} className="cluster-form">
            <h3>{editingClusterId ? '✏️ Edit Cluster' : '➕ Create New Cluster'}</h3>
            
            <div className="form-group">
              <label>Cluster Name *</label>
              <input
                type="text"
                placeholder="Enter cluster name"
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                className="cluster-input"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Enter cluster description (optional)"
                value={newClusterDescription}
                onChange={(e) => setNewClusterDescription(e.target.value)}
                className="cluster-input"
                rows="3"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Add Members to Cluster</label>
              <div className="members-selector">
                {availableUsers && availableUsers.length > 0 ? (
                  <>
                    <button
                      type="button"
                      className="btn-open-member-modal"
                      onClick={() => setShowMemberModal(true)}
                      disabled={loading}
                    >
                      Search and Select Members
                    </button>

                    {selectedMembers.length > 0 ? (
                      <div className="selected-members-preview">
                        {selectedMembers.map(memberId => {
                          const matchedUser = availableUsers.find(user => user._id === memberId);
                          return (
                            <span key={memberId} className="selected-member-chip">
                              {matchedUser?.displayName || 'User'}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="no-members">No members selected</p>
                    )}
                  </>
                ) : (
                  <p className="no-members">No project members available</p>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn-save" 
                disabled={loading}
              >
                {loading ? 'Processing...' : (editingClusterId ? 'Update' : 'Create')}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={handleCancelEdit}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {project.clusters && project.clusters.length > 0 ? (
        <div className="clusters-grid">
          {project.clusters.map(cluster => (
            <div key={cluster._id} className="cluster-card">
              <div className="cluster-header">
                <div>
                  <h4>{cluster.name}</h4>
                  {cluster.description && (
                    <p className="cluster-description">{cluster.description}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="cluster-actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleEditCluster(cluster)}
                      title="Edit cluster"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-remove"
                      onClick={() => handleRemoveCluster(cluster._id)}
                      title="Delete cluster"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="cluster-members">
                <div className="members-header">
                  <strong>Members: {cluster.members?.length || 0}</strong>
                </div>
                {cluster.members && cluster.members.length > 0 ? (
                  <ul className="members-list-display">
                    {cluster.members.map(member => (
                      <li key={getUserId(member) || member._id} className="member-item">
                        <span className="member-info">
                          <span className="member-name">
                            {getDisplayName(member)}
                          </span>
                          <span className={`member-role role-${member.clusterRole || member.role || 'member'}`}>
                            {member.clusterRole || member.role || 'member'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-members-text">No members in this cluster</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : !showCreateForm && editingClusterId === null ? (
        <div className="empty-state">
          <p>📦 No clusters yet</p>
          <p className="empty-text">Create a cluster to organize your team members</p>
        </div>
      ) : null}
    </div>
  );
};

export default ClusterManager;
