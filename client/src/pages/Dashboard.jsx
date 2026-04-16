import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TaskItem from '../components/TaskItem';
import TeamMemberCard from '../components/TeamMemberCard';
import CreateTaskModal from '../components/CreateTaskModal';
import PageLoader from '../components/PageLoader';
import './Dashboard.css';
import api from '../services/api';

const Dashboard = () => {
  const [myTasks, setMyTasks] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);
  const [assignedToOthers, setAssignedToOthers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  const handleToggleComplete = async (taskId) => {
    const allTasks = [...myTasks, ...assignedToMe, ...assignedToOthers];
    const taskToUpdate = allTasks.find(t => t._id === taskId);
    if (!taskToUpdate) return;

    const newStatus = taskToUpdate.status === 'done' ? 'todo' : 'done';

    try {
      const { data: updatedTask } = await api.put(`/tasks/${taskId}/status`, { status: newStatus });

      const updateState = (tasks) => tasks.map(t => t._id === taskId ? updatedTask : t);
      
      setMyTasks(updateState(myTasks));
      setAssignedToMe(updateState(assignedToMe));
      setAssignedToOthers(updateState(assignedToOthers));

    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await api.delete(`/tasks/${taskId}`);

      // Remove the task from all task lists
      setMyTasks(myTasks.filter(t => t._id !== taskId));
      setAssignedToMe(assignedToMe.filter(t => t._id !== taskId));
      setAssignedToOthers(assignedToOthers.filter(t => t._id !== taskId));
    } catch (error) {
      console.error('Failed to delete task', error);
      alert('Failed to delete task');
    }
  };

  const handleCreateTask = async (newTaskData) => {
    try {
      const { data: createdTask } = await api.post('/tasks', newTaskData);
      
      // Ensure creator and assignee have proper structure
      const taskWithDetails = {
        ...createdTask,
        creator: { ...createdTask.creator, _id: user._id },
        assignee: createdTask.assignee || { _id: user._id, username: user.username }
      };

      // If task is assigned to someone else, add to assignedToOthers
      if (createdTask.assignee && createdTask.assignee._id !== user._id) {
        setAssignedToOthers(prevTasks => [taskWithDetails, ...prevTasks]);
      } else {
        // Otherwise it's a personal task
        setMyTasks(prevTasks => [taskWithDetails, ...prevTasks]);
      }
      
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

  const fetchAllUsers = async () => {
    try {
      const { data } = await api.get('/users/all');
      // Filter out current user from the list
      const otherUsers = data.filter(u => u._id !== user?._id);
      setAllUsers(otherUsers);
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const tasksRes = await api.get('/tasks');
        const data = tasksRes.data;

        // Categorize tasks into 3 groups
        const tasksAssignedToMe = data.filter(
          (task) => task.assignee._id === user._id && task.creator._id !== user._id
        );
        
        const tasksAssignedToOthers = data.filter(
          (task) => task.creator._id === user._id && task.assignee._id !== user._id
        );
        
        const myPersonalTasks = data.filter(
          (task) => task.creator._id === user._id && task.assignee._id === user._id
        );

        setAssignedToMe(tasksAssignedToMe);
        setAssignedToOthers(tasksAssignedToOthers);
        setMyTasks(myPersonalTasks);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    fetchAllUsers();
  }, [user]);

  const totalTasks = myTasks.length + assignedToMe.length + assignedToOthers.length;
  const completedTasks = [...myTasks, ...assignedToMe, ...assignedToOthers].filter(t => t.status === 'done').length;
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
          <h3>Assigned to Others</h3>
          <p className="stat-number">{assignedToOthers.length}</p>
          <p className="stat-label">Tasks delegated</p>
        </div>
        <div className="stat-card">
          <h3>Assigned to You</h3>
          <p className="stat-number">{assignedToMe.length}</p>
          <p className="stat-label">Pending tasks</p>
        </div>
      </div>

      {isLoading ? (
        <PageLoader text="Loading your dashboard..." />
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
                    <TaskItem key={task._id} task={task} onToggleComplete={handleToggleComplete} onDelete={handleDeleteTask} isCreator={task.creator._id === user._id} userRole={user.role} userId={user._id} />
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
                    <TaskItem key={task._id} task={task} onToggleComplete={handleToggleComplete} onDelete={handleDeleteTask} isCreator={task.creator._id === user._id} userRole={user.role} userId={user._id} />
                  ))}
                </div>
              ) : (
                <p className="no-tasks-msg">You haven't created any personal tasks yet.</p>
              )}
            </section>
          </div>

          {/* Right Column - Team Overview */}
          <div className="dashboard-right">
            <section className="team-section">
              <div className="section-header">
                <h2>👥 Team Members</h2>
                {allUsers.length > 0 && (
                  <span className="badge">{allUsers.length}</span>
                )}
              </div>
              {allUsers.length > 0 ? (
                <div className="team-preview-grid">
                  {allUsers
                    .map(member => {
                      // Get all tasks assigned to this member (from anyone, including themselves)
                      const allMemberTasks = [...myTasks, ...assignedToMe, ...assignedToOthers].filter(
                        task => task.assignee._id === member._id
                      );
                      return {
                        ...member,
                        assignedTasksCount: allMemberTasks.length,
                        tasks: allMemberTasks
                      };
                    })
                    .sort((a, b) => b.assignedTasksCount - a.assignedTasksCount)
                    .slice(0, 4)
                    .map(member => (
                      <TeamMemberCard 
                        key={member._id} 
                        member={member}
                        onAssignTask={handleOpenAssignModal} 
                      />
                    ))}
                  {allUsers.length > 4 && (
                    <div className="view-more-card">
                      <p>+ {allUsers.length - 4} more</p>
                      <a href="/team" className="view-more-link">View Full Team →</a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-team-state">
                  <h3>No other team members</h3>
                  <p>You are the only member in your organization</p>
                  <a href="/team" className="add-team-btn">View All Users →</a>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;