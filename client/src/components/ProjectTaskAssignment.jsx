import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { createAssignedTask, getEntityId } from '../services/taskAssignmentService';
import './ProjectTaskAssignment.css';

const ProjectTaskAssignment = ({ project, onTaskCreated, canEdit }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [selectedMember, setSelectedMember] = useState('');
  const [projectTasks, setProjectTasks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchProjectTasks();
  }, [project._id]);

  const fetchProjectTasks = async () => {
    try {
      // Fetch all tasks and filter by project
      const { data: allTasks } = await api.get('/tasks');
      const filtered = allTasks.filter(task => 
        task.projectId && (task.projectId._id === project._id || task.projectId === project._id)
      );
      setProjectTasks(filtered);
    } catch (error) {
      console.error('Failed to fetch project tasks:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      const newTask = await createAssignedTask({
        title,
        priority,
        assigneeId: selectedMember || undefined,
        currentUserId: getEntityId(user),
        projectId: project._id,
        status: 'todo'
      });
      
      setProjectTasks([...projectTasks, newTask]);
      setTitle('');
      setPriority('medium');
      setSelectedMember('');
      setShowForm(false);
      
      if (onTaskCreated) {
        const { data: updatedProject } = await api.get(`/projects/${project._id}`);
        onTaskCreated(updatedProject);
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="project-task-assignment">
      <div className="task-assignment-header">
        <h4>📌 Project Tasks ({projectTasks.length})</h4>
        {canEdit && (
          <button className="project-task-add-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕' : '+'}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="task-assignment-form">
          <div className="form-field">
            <input
              type="text"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="form-select priority-select"
                disabled={isSubmitting}
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>

            <div className="form-field">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="form-select"
                disabled={isSubmitting}
              >
                <option value="">Assign to...</option>
                {project.members?.map(member => {
                  const memberName = member.userId?.firstName && member.userId?.lastName
                    ? `${member.userId.firstName} ${member.userId.lastName}`
                    : member.userId?.username || 'Unknown';
                  return (
                    <option key={member.userId?._id || member.userId} value={member.userId?._id || member.userId}>
                      {memberName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn-create-task"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      )}

      {projectTasks.length > 0 ? (
        <div className="project-tasks-list">
          {projectTasks.map(task => (
            <div key={task._id} className={`project-task-item ${task.status === 'done' ? 'done' : ''}`}>
              <div className="task-item-left">
                <span className={`priority-dot priority-${task.priority}`} title={task.priority}></span>
                <div className="task-item-info">
                  <p className="task-item-title">{task.title}</p>
                  {task.assignee && (
                    <span className="task-assignee">
                      👤 {task.assignee.firstName && task.assignee.lastName 
                        ? `${task.assignee.firstName} ${task.assignee.lastName}`
                        : task.assignee.username}
                    </span>
                  )}
                </div>
              </div>
              <span className={`task-status-badge status-${task.status}`}>
                {task.status === 'todo' ? '📝' : task.status === 'done' ? '✓' : '⏳'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-tasks">
          <p>No tasks yet for this project</p>
          {canEdit && <span className="hint">Click + to create your first task</span>}
        </div>
      )}
    </div>
  );
};

export default ProjectTaskAssignment;
