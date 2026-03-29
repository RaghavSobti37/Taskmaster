import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TaskItem from '../components/TaskItem';
import TeamMemberCard from '../components/TeamMemberCard';
import CreateTaskModal from '../components/CreateTaskModal';
import './Dashboard.css';
import api from '../services/api';

const Dashboard = () => {
  const [myTasks, setMyTasks] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);
  const [team, setTeam] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  const handleToggleComplete = async (taskId) => {
    const allTasks = [...myTasks, ...assignedToMe];
    const taskToUpdate = allTasks.find(t => t._id === taskId);
    if (!taskToUpdate) return;

    const newStatus = taskToUpdate.status === 'done' ? 'todo' : 'done';

    try {
      const { data: updatedTask } = await api.put(`/tasks/${taskId}/status`, { status: newStatus });

      const updateState = (tasks) => tasks.map(t => t._id === taskId ? updatedTask : t);
      
      setMyTasks(updateState(myTasks));
      setAssignedToMe(updateState(assignedToMe));

    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  const handleCreateTask = async (newTaskData) => {
    try {
      const { data: createdTask } = await api.post('/tasks', newTaskData);
      const taskForUi = { ...createdTask, creator: { username: user.username } };
      setMyTasks(prevTasks => [taskForUi, ...prevTasks]);
      setIsModalOpen(false);
      setAssignee(null);
    } catch (error) {
      console.error('Failed to create task', error);
    }
  };

  const handleOpenAssignModal = (member) => {
    setAssignee(member);
    setIsModalOpen(true);
  };

  const fetchTeam = async () => {
    try {
      const { data } = await api.get('/users/team');
      setTeam(data);
    } catch (error) {
      console.error("Failed to fetch team", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const [tasksRes, teamRes] = await Promise.all([
          api.get('/tasks'),
          api.get('/users/team')
        ]);

        const data = tasksRes.data;
        const tasksForMe = data.filter(
          (task) => task.assignee === user._id && task.creator._id !== user._id
        );
        const tasksByMe = data.filter((task) => task.creator._id === user._id);

        setAssignedToMe(tasksForMe);
        setMyTasks(tasksByMe);
        setTeam(teamRes.data);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const totalTasks = myTasks.length + assignedToMe.length;
  const completedTasks = [...myTasks, ...assignedToMe].filter(t => t.status === 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="dashboard-container">
      {isModalOpen && <CreateTaskModal onClose={() => setIsModalOpen(false)} onCreateTask={handleCreateTask} assignee={assignee} />}
      
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Welcome, {user?.username}! 👋</h1>
          <p className="header-subtitle">Manage your tasks and team efficiently</p>
        </div>
        <button className="create-task-btn" onClick={() => setIsModalOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          Create Task
        </button>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total Tasks</h3>
          <p className="stat-number">{totalTasks}</p>
          <p className="stat-label">Across all categories</p>
        </div>
        <div className="stat-card">
          <h3>Completion Rate</h3>
          <p className="stat-number">{completionRate}%</p>
          <p className="stat-label">{completedTasks} of {totalTasks} done</p>
        </div>
        <div className="stat-card">
          <h3>Team Members</h3>
          <p className="stat-number">{team.length}</p>
          <p className="stat-label">In your team</p>
        </div>
        <div className="stat-card">
          <h3>Assigned to You</h3>
          <p className="stat-number">{assignedToMe.length}</p>
          <p className="stat-label">Pending tasks</p>
        </div>
      </div>

      {isLoading ? (
        <p className="loading-msg">Loading your dashboard...</p>
      ) : (
        <div className="dashboard-main">
          {/* Left Column - Tasks */}
          <div className="dashboard-left">
            {/* Assigned to Me Section */}
            <section className="task-section">
              <div className="section-header">
                <h2>📥 Assigned to Me</h2>
                {assignedToMe.length > 0 && (
                  <span className="badge">{assignedToMe.length}</span>
                )}
              </div>
              {assignedToMe.length > 0 ? (
                <div className="task-list">
                  {assignedToMe.slice(0, 5).map(task => (
                    <TaskItem key={task._id} task={task} onToggleComplete={handleToggleComplete} />
                  ))}
                </div>
              ) : (
                <p className="no-tasks-msg">No tasks assigned to you right now. Great job! 🎉</p>
              )}
            </section>

            {/* My Tasks Section */}
            <section className="task-section">
              <div className="section-header">
                <h2>✅ My Tasks</h2>
                {myTasks.length > 0 && (
                  <span className="badge">{myTasks.length}</span>
                )}
              </div>
              {myTasks.length > 0 ? (
                <div className="task-list">
                  {myTasks.slice(0, 5).map(task => (
                    <TaskItem key={task._id} task={task} onToggleComplete={handleToggleComplete} />
                  ))}
                </div>
              ) : (
                <p className="no-tasks-msg">You haven't created any tasks yet.</p>
              )}
            </section>
          </div>

          {/* Right Column - Team Overview */}
          <div className="dashboard-right">
            <section className="team-section">
              <div className="section-header">
                <h2>👥 Team Overview</h2>
                {team.length > 0 && (
                  <span className="badge">{team.length}</span>
                )}
              </div>
              {team.length > 0 ? (
                <div className="team-preview-grid">
                  {team.slice(0, 4).map(member => (
                    <TeamMemberCard key={member._id} member={member} onAssignTask={handleOpenAssignModal} />
                  ))}
                  {team.length > 4 && (
                    <div className="view-more-card">
                      <p>+ {team.length - 4} more</p>
                      <a href="/team" className="view-more-link">View Full Team →</a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-team-state">
                  <h3>Your team is empty</h3>
                  <p>Add team members to collaborate and assign tasks</p>
                  <a href="/team" className="add-team-btn">Go to Team Page →</a>
                </div>
              )}
            </section>

            {/* Quick Actions */}
            <section className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-list">
                <a href="/team" className="action-item">
                  <span className="action-icon">👥</span>
                  <div>
                    <p className="action-title">Manage Team</p>
                    <p className="action-desc">Add or remove team members</p>
                  </div>
                </a>
                <button onClick={() => setIsModalOpen(true)} className="action-item">
                  <span className="action-icon">➕</span>
                  <div>
                    <p className="action-title">Create Task</p>
                    <p className="action-desc">Add a new task or assignment</p>
                  </div>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;