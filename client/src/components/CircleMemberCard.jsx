import React from 'react';
import ProfileAvatar from './ProfileAvatar';
import './CircleMemberCard.css';

const CircleMemberCard = ({ member, onAssignTask }) => {
  const activeTasks = member.tasks.filter(task => task.status !== 'done');

  return (
    <div className="member-card">
      <div className="member-card-header">
        <ProfileAvatar username={member.username} />
        <div className="member-info">
          <h3 className="member-name">{member.username}</h3>
          <span className="member-task-count">{activeTasks.length} active tasks</span>
        </div>
      </div>
      <div className="member-card-body">
        <h4>Tasks:</h4>
        {activeTasks.length > 0 ? (
          <ul className="member-task-list">
            {activeTasks.slice(0, 5).map(task => ( // Show up to 5 tasks
              <li key={task._id}>{task.title}</li>
            ))}
          </ul>
        ) : (
          <p className="no-member-tasks">No active tasks.</p>
        )}
      </div>
      <div className="member-card-footer">
        <button className="assign-task-btn" onClick={() => onAssignTask(member)}>Assign Task</button>
      </div>
    </div>
  );
};

export default CircleMemberCard;