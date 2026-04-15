import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserSearchModal from './UserSearchModal';
import api from '../services/api';
import { createAssignedTask, getEntityId } from '../services/taskAssignmentService';
import './TeamManager.css';

const TeamManager = ({ project, onProjectChange, canEdit }) => {
  const { user } = useAuth();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('tech');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingRole, setEditingRole] = useState('tech');
  const [projectTasks, setProjectTasks] = useState([]);
  const [loadedTasksForProjectId, setLoadedTasksForProjectId] = useState(null);
  const [taskDraftByMember, setTaskDraftByMember] = useState({});

  const ROLE_OPTIONS = [
    { value: 'lead', label: 'Lead' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'tech', label: 'Tech' },
    { value: 'content', label: 'Content' }
  ];

  const normalizeRole = (role) => {
    if (role === 'admin' || role === 'manager') return 'lead';
    if (role === 'member') return 'tech';
    return role || 'tech';
  };

  const fetchProjectTasks = async () => {
    try {
      const { data: allTasks } = await api.get('/tasks');
      const filtered = allTasks.filter((task) =>
        task.projectId && (task.projectId._id === project._id || task.projectId === project._id)
      );
      setProjectTasks(filtered);
      setLoadedTasksForProjectId(project._id);
    } catch (error) {
      console.error('Failed to fetch project tasks:', error);
    }
  };

  useEffect(() => {
    fetchProjectTasks();
  }, [project._id]);

  const ensureProjectTasksLoaded = async () => {
    if (loadedTasksForProjectId !== project._id) {
      await fetchProjectTasks();
    }
  };

  const toggleTaskForm = async (memberId) => {
    await ensureProjectTasksLoaded();
    setTaskDraftByMember((prev) => {
      if (prev[memberId]) {
        const updated = { ...prev };
        delete updated[memberId];
        return updated;
      }
      return {
        ...prev,
        [memberId]: {
          title: '',
          priority: 'medium',
          isSubmitting: false
        }
      };
    });
  };

  const updateTaskDraft = (memberId, key, value) => {
    setTaskDraftByMember((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] || { title: '', priority: 'medium', isSubmitting: false }),
        [key]: value
      }
    }));
  };

  const handleCreateTaskForMember = async (memberId) => {
    const draft = taskDraftByMember[memberId];
    if (!draft?.title?.trim()) {
      alert('Please enter a task title');
      return;
    }

    updateTaskDraft(memberId, 'isSubmitting', true);

    try {
      await createAssignedTask({
        title: draft.title,
        priority: draft.priority,
        assigneeId: memberId,
        currentUserId: getEntityId(user),
        projectId: project._id,
        status: 'todo'
      });

      await fetchProjectTasks();

      setTaskDraftByMember((prev) => {
        const updated = { ...prev };
        delete updated[memberId];
        return updated;
      });
    } catch (error) {
      console.error('Failed to create task:', error);
      alert(`Error: ${error.response?.data?.message || error.message}`);
      updateTaskDraft(memberId, 'isSubmitting', false);
    }
  };

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
      onProjectChange(updatedProject.data);
      setShowSearchModal(false);
      setSelectedRole('tech');
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
      onProjectChange(updatedProject.data);
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
      onProjectChange(updatedProject.data);
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
      <div className="team-actions-row">
        <h3 className="team-title">Team Members ({project.members?.length || 0})</h3>
        {canEdit && (
          <button className="btn-add-member" onClick={() => setShowSearchModal(true)}>
            + Add Team Members
          </button>
        )}
      </div>

      <UserSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectUsers={handleAddMembers}
        title="Add Members to Project"
        selectedUserIds={getProjectMemberIds()}
        allowMultiple={true}
      />

      {project.members && project.members.length > 0 ? (
        <div className="members-list">
          {project.members.map(member => {
            // Handle both populated and unpopulated references
            const memberData = typeof member.userId === 'object' ? member.userId : member;
            const memberId = typeof member.userId === 'object' ? member.userId._id : member.userId;
            const role = member.role || 'member';

            const memberTasks = projectTasks
              .filter((task) => {
                const assigneeId = task.assignee?._id || task.assignee;
                return assigneeId === memberId;
              })
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            const activeTasks = memberTasks.filter((task) => task.status !== 'done');
            const roleValue = normalizeRole(role);
            const roleLabel = ROLE_OPTIONS.find((item) => item.value === roleValue)?.label || 'Tech';
            const taskDraft = taskDraftByMember[memberId];

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
                        {ROLE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
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
                        className={`role-badge role-${roleValue}`}
                        onClick={() => {
                          if (canEdit) {
                            setEditingMemberId(memberId);
                            setEditingRole(normalizeRole(role));
                          }
                        }}
                        style={{ cursor: canEdit ? 'pointer' : 'default' }}
                      >
                        {roleLabel}
                        {canEdit && <span className="edit-hint">✎</span>}
                      </span>
                    </>
                  )}

                  {canEdit && (
                    <button
                      className="btn-add-member-task"
                      onClick={() => toggleTaskForm(memberId)}
                      title="Add task for this member"
                    >
                      + Task
                    </button>
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

                <div className="member-task-section">
                  {taskDraft && (
                    <div className="member-task-form">
                      <input
                        type="text"
                        className="member-task-input"
                        placeholder="Task title"
                        value={taskDraft.title}
                        onChange={(e) => updateTaskDraft(memberId, 'title', e.target.value)}
                        disabled={taskDraft.isSubmitting}
                      />
                      <select
                        className="member-task-priority"
                        value={taskDraft.priority}
                        onChange={(e) => updateTaskDraft(memberId, 'priority', e.target.value)}
                        disabled={taskDraft.isSubmitting}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <button
                        className="btn-create-member-task"
                        onClick={() => handleCreateTaskForMember(memberId)}
                        disabled={taskDraft.isSubmitting}
                      >
                        {taskDraft.isSubmitting ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}

                  {memberTasks.length > 0 ? (
                    <div className="member-task-list">
                      {memberTasks.slice(0, 4).map((task) => (
                        <div key={task._id} className="member-task-item">
                          <span className={`member-task-dot task-priority-${task.priority}`}></span>
                          <span className="member-task-title">{task.title}</span>
                          <span className={`member-task-status status-${task.status}`}>
                            {task.status === 'done' ? 'Done' : task.status === 'in-progress' ? 'In Progress' : 'To Do'}
                          </span>
                        </div>
                      ))}
                      {memberTasks.length > 4 && (
                        <div className="member-task-more">+{memberTasks.length - 4} more tasks</div>
                      )}
                    </div>
                  ) : (
                    <div className="member-task-empty">No assigned tasks</div>
                  )}

                  <div className="member-task-summary">
                    Active Tasks: {activeTasks.length} / Total: {memberTasks.length}
                  </div>
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
