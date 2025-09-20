import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TaskItem from '../components/TaskItem';
import CreateTaskModal from '../components/CreateTaskModal';
import './Dashboard.css';
import api from '../services/api';

const Dashboard = () => {
  const [myTasks, setMyTasks] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      // The backend populates the creator, so we need to add it for the UI
      const taskForUi = { ...createdTask, creator: { username: user.username } };
      setMyTasks(prevTasks => [taskForUi, ...prevTasks]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create task', error);
    }
  };

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) return;
      try {
        const { data } = await api.get('/tasks');
        
        // Filter tasks into "Assigned to Me" and "My Tasks"
        const tasksForMe = data.filter(
          (task) => task.assignee === user._id && task.creator._id !== user._id
        );
        const tasksByMe = data.filter((task) => task.creator._id === user._id);

        setAssignedToMe(tasksForMe);
        setMyTasks(tasksByMe);
      } catch (error) {
        console.error('Failed to fetch tasks', error);
        // Handle error (e.g., if token is expired, logout user)
      }
    };

    fetchTasks();
  }, [user]);

  return (
    <div className="dashboard-container">
      {isModalOpen && <CreateTaskModal onClose={() => setIsModalOpen(false)} onCreateTask={handleCreateTask} />}
      <div className="dashboard-header">
        <h1>Home</h1>
        <button className="create-task-btn" onClick={() => setIsModalOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          Create Task
        </button>
      </div>

      <div className="task-columns">
        <section className="task-list">
          <h2>Tasks Assigned to Me</h2>
          {assignedToMe.length > 0 ? (
            assignedToMe.map(task => <TaskItem key={task._id} task={task} onToggleComplete={handleToggleComplete} />)
          ) : (
            <p className="no-tasks-msg">No tasks assigned to you right now.</p>
          )}
        </section>

        <section className="task-list">
          <h2>My Tasks</h2>
          {myTasks.length > 0 ? (
            myTasks.map(task => <TaskItem key={task._id} task={task} onToggleComplete={handleToggleComplete} />)
          ) : (
            <p className="no-tasks-msg">You haven't created any tasks yet.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;