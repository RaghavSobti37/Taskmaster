import React, { useState } from 'react';
import './ClusterManager.css';

const ClusterManager = ({ project, onUpdate, canEdit, apiUrl }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterDescription, setNewClusterDescription] = useState('');
  const [editingClusterId, setEditingClusterId] = useState(null);

  const handleCreateCluster = async (e) => {
    e.preventDefault();

    if (!newClusterName.trim()) {
      alert('Cluster name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/projects/${project._id}/clusters`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newClusterName,
          description: newClusterDescription
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create cluster');
      }

      const updatedProject = await response.json();
      onUpdate(project._id, updatedProject);
      setNewClusterName('');
      setNewClusterDescription('');
      setShowCreateForm(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemoveCluster = async (clusterId) => {
    if (!window.confirm('Delete this cluster and all its members?')) return;

    try {
      const updatedClusters = project.clusters.filter(c => c._id !== clusterId);
      await onUpdate(project._id, { clusters: updatedClusters });
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="cluster-manager">
      {canEdit && !showCreateForm && (
        <button className="btn-add-cluster" onClick={() => setShowCreateForm(true)}>
          + Add Cluster
        </button>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateCluster} className="cluster-form">
          <input
            type="text"
            placeholder="Cluster name"
            value={newClusterName}
            onChange={(e) => setNewClusterName(e.target.value)}
            className="cluster-input"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newClusterDescription}
            onChange={(e) => setNewClusterDescription(e.target.value)}
            className="cluster-input"
          />
          <div className="form-actions">
            <button type="submit" className="btn-save">Create</button>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {project.clusters && project.clusters.length > 0 ? (
        <div className="clusters-grid">
          {project.clusters.map(cluster => (
            <div key={cluster._id} className="cluster-card">
              <div className="cluster-header">
                <h4>{cluster.name}</h4>
                {canEdit && (
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveCluster(cluster._id)}
                  >
                    ✕
                  </button>
                )}
              </div>

              {cluster.description && (
                <p className="cluster-description">{cluster.description}</p>
              )}

              <div className="cluster-members">
                <strong>Members: {cluster.members?.length || 0}</strong>
                {cluster.members && cluster.members.length > 0 && (
                  <ul>
                    {cluster.members.map(member => (
                      <li key={member._id} className="member-item">
                        <span className="member-name">
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.username}
                        </span>
                        <span className={`member-role role-${member.clusterRole}`}>
                          {member.clusterRole}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No clusters yet. Create one to organize your team!</p>
        </div>
      )}
    </div>
  );
};

export default ClusterManager;
