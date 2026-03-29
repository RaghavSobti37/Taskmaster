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
    <div className="member-card">
      <div className="member-card-header">
        <div className="member-card-avatar-wrapper">
          <ProfileAvatar username={member.username} />
          {activeTasks.length > 0 && (
            <span className="task-badge">{activeTasks.length}</span>
          )}
        </div>
        <div className="member-info">
          <div className="member-name-row">
            <h3 className="member-name">{member.username}</h3>
            <span 
              className="member-role-badge" 
              style={{ backgroundColor: roleColors[member.role] || roleColors.user }}
            >
              {member.role || 'user'}
            </span>
          </div>
          <p className="member-status">Active • Online</p>
        </div>
      </div>
      
      {activeTasks.length > 0 && (
        <div className="member-card-body">
          <div className="tasks-header">
            <h4>Active Tasks</h4>
            <span className="task-count-label">{activeTasks.length} of {tasks.length}</span>
          </div>
          <ul className="member-task-list">
            {activeTasks.slice(0, 4).map((task, index) => (
              <li key={task._id} className="task-item">
                <span className="task-number">{index + 1}</span>
                <span className="task-title">{task.title}</span>
              </li>
            ))}
          </ul>
          {activeTasks.length > 4 && (
            <p className="more-tasks">+{activeTasks.length - 4} more tasks</p>
          )}
        </div>
      )}
      
      <div className="member-card-footer">
        <button className="assign-task-btn" onClick={() => onAssignTask(member)}>
          <span className="btn-icon">+</span>
          Assign Task
        </button>
      </div>
    </div>
  );
};

export default TeamMemberCard;