import React from 'react';
import ProfileAvatar from './ProfileAvatar';
import './TeamMemberCard.css';

const TeamMemberCard = ({ member, onAssignTask }) => {
  const tasks = member.tasks || [];
  const activeTasks = tasks.filter(task => task.status !== 'done');
  const roleColors = {
    admin: '#e85d3f',
    lead: '#f4b860',
    user: '#128c6e'
  };

  return (
    <div className="tmc-card">
      <div className="tmc-header">
        <div className="tmc-left">
          <div className="tmc-avatar-wrapper">
            <ProfileAvatar username={member.username} />
            {activeTasks.length > 0 && (
              <span className="tmc-task-badge">{activeTasks.length}</span>
            )}
          </div>
          <div className="tmc-info">
            <div className="tmc-name-row">
              <h3 className="tmc-name">{member.username}</h3>
              <span 
                className="tmc-role-badge" 
                style={{ backgroundColor: roleColors[member.role] || roleColors.user }}
              >
                {member.role || 'user'}
              </span>
            </div>
            <p className="tmc-status">Active • Online</p>
          </div>
        </div>

        <div className="tmc-actions">
          <button className="tmc-assign-task-btn" onClick={() => onAssignTask(member)}>
            <span className="tmc-btn-icon">+</span>
            Assign Task
          </button>
        </div>
      </div>
      
      {activeTasks.length > 0 && (
        <div className="tmc-body">
          <div className="tmc-tasks-header">
            <h4>Active Tasks</h4>
            <span className="tmc-task-count-label">{activeTasks.length} of {tasks.length}</span>
          </div>
          <ul className="tmc-task-list">
            {activeTasks.slice(0, 4).map((task, index) => (
              <li key={task._id} className="tmc-task-item">
                <span className="tmc-task-number">{index + 1}</span>
                <span className="tmc-task-title">{task.title}</span>
              </li>
            ))}
          </ul>
          {activeTasks.length > 4 && (
            <p className="tmc-more-tasks">+{activeTasks.length - 4} more tasks</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamMemberCard;