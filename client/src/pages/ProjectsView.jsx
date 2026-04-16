import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import CreateProjectModal from '../components/CreateProjectModal';
import ProjectCard from '../components/ProjectCard';
import ProjectDetail from '../components/ProjectDetail';
import PageLoader from '../components/PageLoader';
import './ProjectsView.css';

const ProjectsView = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all projects
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/projects');
      setProjects(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData) => {
    try {
      const response = await api.post('/projects', projectData);
      setProjects([...projects, response.data]);
      setShowCreateModal(false);
    } catch (err) {
      alert(`Error creating project: ${err.message}`);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await api.delete(`/projects/${projectId}`);
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
      const response = await api.put(`/projects/${projectId}`, updates);
      setProjects(projects.map(p => p._id === projectId ? response.data : p));
      setSelectedProject(response.data);
    } catch (err) {
      alert(`Error updating project: ${err.message}`);
    }
  };

  const handleProjectChange = (updatedProject) => {
    if (!updatedProject?._id) return;

    setProjects(prevProjects =>
      prevProjects.map(p => p._id === updatedProject._id ? updatedProject : p)
    );
    setSelectedProject(updatedProject);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="projects-view loading"><PageLoader text="Loading projects..." /></div>;
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
              onProjectChange={handleProjectChange}
              onClose={() => setSelectedProject(null)}
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
