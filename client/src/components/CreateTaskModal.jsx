import React, { useState } from 'react';
import './CreateTaskModal.css';

const CreateTaskModal = ({ onClose, onCreateTask, assignee = null }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Pass the assignee's ID if it exists
    onCreateTask({ title, description, priority, assignee: assignee ? assignee._id : null });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{assignee ? `Assign Task to ${assignee.username}` : 'Create a New Task'}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Finish the project report"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="task-description">Description (Optional)</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              placeholder="Add more details about the task..."
            ></textarea>
          </div>
          <div className="form-group">
            <label htmlFor="task-priority">Priority</label>
            <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {/* Add fields for Assignee, Due Date, etc. here */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;