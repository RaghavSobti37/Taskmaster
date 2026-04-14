import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CreateProjectModal from '../components/CreateProjectModal';
import ProjectCard from '../components/ProjectCard';
import ProjectDetail from '../components/ProjectDetail';
import './ProjectsView.css';

const ProjectsView = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch all projects
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await response.json();
      setProjects([...projects, newProject]);
      setShowCreateModal(false);
    } catch (err) {
      alert(`Error creating project: ${err.message}`);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects(projects.filter(p => p._id !== projectId));
      if (selectedProject?._id === projectId) {
        setSelectedProject(null);
      }
    } catch (err) {
      alert(`Error deleting project: ${err.message}`);
    }
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      const updatedProject = await response.json();
      setProjects(projects.map(p => p._id === projectId ? updatedProject : p));
      setSelectedProject(updatedProject);
    } catch (err) {
      alert(`Error updating project: ${err.message}`);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="projects-view loading">Loading projects...</div>;
  }

  return (
    <div className="projects-view">
      <div className="projects-header">
        <h1>Projects</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Project
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="projects-search">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="projects-container">
        <div className="projects-list">
          <h2>Your Projects ({filteredProjects.length})</h2>
          
          {filteredProjects.length === 0 ? (
            <div className="empty-state">
              <p>No projects yet. Create your first project!</p>
              <button
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="projects-grid">
              {filteredProjects.map(project => (
                <ProjectCard
                  key={project._id}
                  project={project}
                  onSelect={setSelectedProject}
                  onDelete={handleDeleteProject}
                  isSelected={selectedProject?._id === project._id}
                />
              ))}
            </div>
          )}
        </div>

        {selectedProject && (
          <div className="project-detail-section">
            <ProjectDetail
              project={selectedProject}
              onUpdate={handleUpdateProject}
              onClose={() => setSelectedProject(null)}
              apiUrl={apiUrl}
            />
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onSubmit={handleCreateProject}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

export default ProjectsView;
