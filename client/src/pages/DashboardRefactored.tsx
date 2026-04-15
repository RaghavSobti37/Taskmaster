import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TaskItem from '../components/TaskItem';
import TeamMemberCard from '../components/TeamMemberCard';
import CreateTaskModal from '../components/CreateTaskModal';
import api from '../services/api';
import { createAssignedTask, splitTasksForUser, getEntityId } from '../services/taskAssignmentService';

interface Task {
  _id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'normal' | 'important' | 'urgent';
  creator: { _id: string; username: string };
  assignee: { _id: string; username: string };
  isPersonal?: boolean;
  projectId?: { _id: string; name: string };
  completedAt?: string;
}

interface User {
  _id: string;
  username: string;
  role: string;
  email?: string;
}

const DashboardRefactored: React.FC = () => {
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [assignedToMe, setAssignedToMe] = useState<Task[]>([]);
  const [assignedToOthers, setAssignedToOthers] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // CMD+N or CTRL+N for new task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch tasks and users
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [tasksRes, usersRes] = await Promise.all([
          api.get('/tasks'),
          api.get('/users/all')
        ]);

        const tasks = tasksRes.data;
        const otherUsers = usersRes.data.filter((u: User) => u._id !== user?._id);

        const { myTasks: myTasksList, assignedToMe: assignedList, assignedToOthers: othersList } = splitTasksForUser(tasks, user?._id || '');

        setMyTasks(myTasksList);
        setAssignedToMe(assignedList);
        setAssignedToOthers(othersList);
        setAllUsers(otherUsers);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?._id) {
      fetchData();
    }
  }, [user?._id]);

  const handleToggleComplete = async (taskId: string) => {
    const allTasks = [...myTasks, ...assignedToMe, ...assignedToOthers];
    const taskToUpdate = allTasks.find(t => t._id === taskId);
    if (!taskToUpdate) return;

    const newStatus = taskToUpdate.status === 'done' ? 'todo' : 'done';

    try {
      const { data: updatedTask } = await api.put(`/tasks/${taskId}/status`, { status: newStatus });

      const updateState = (tasks: Task[]) => tasks.map(t => t._id === taskId ? updatedTask : t);

      setMyTasks(updateState(myTasks));
      setAssignedToMe(updateState(assignedToMe));
      setAssignedToOthers(updateState(assignedToOthers));
    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
      setMyTasks(myTasks.filter(t => t._id !== taskId));
      setAssignedToMe(assignedToMe.filter(t => t._id !== taskId));
      setAssignedToOthers(assignedToOthers.filter(t => t._id !== taskId));
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleCreateTask = async (newTaskData: any) => {
    try {
      const createdTask = await createAssignedTask({
        title: newTaskData.title,
        description: newTaskData.description,
        priority: newTaskData.priority,
        assigneeId: getEntityId(newTaskData.assignee),
        currentUserId: user?._id || '',
        projectId: newTaskData.projectId,
        status: 'todo',
        dueDate: newTaskData.dueDate
      });

      const creatorId = getEntityId(createdTask.creator);
      const assigneeId = getEntityId(createdTask.assignee);

      if (creatorId === user?._id) {
        setMyTasks(prev => [createdTask, ...prev]);
      }

      if (assigneeId === user?._id && creatorId !== user?._id) {
        setAssignedToMe(prev => [createdTask, ...prev]);
      }

      if (creatorId === user?._id && assigneeId && assigneeId !== user?._id) {
        setAssignedToOthers(prev => [createdTask, ...prev]);
      }

      setIsModalOpen(false);
      setAssignee(null);
    } catch (error) {
      console.error('Failed to create task', error);
    }
  };

  const handleOpenAssignModal = (member: User) => {
    setAssignee(member);
    setIsModalOpen(true);
  };

  const getTaskStats = () => ({
    total: myTasks.length + assignedToMe.length + assignedToOthers.length,
    completed: [...myTasks, ...assignedToMe, ...assignedToOthers].filter(t => t.status === 'done').length,
    inProgress: [...myTasks, ...assignedToMe, ...assignedToOthers].filter(t => t.status === 'in_progress').length
  });

  const stats = getTaskStats();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
  };

  const taskSection = (title: string, tasks: Task[], count: number) => (
    <motion.div
      key={title}
      variants={itemVariants}
      className="min-h-0"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">
          {title}
        </h3>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          {count}
        </span>
      </div>

      <motion.div
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {tasks.length > 0 ? (
          tasks.map((task, idx) => (
            <motion.div key={task._id} variants={itemVariants} layout>
              <TaskItem
                task={task}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDeleteTask}
                isCreator={task.creator._id === user?._id}
                userRole={user?.role || 'user'}
                userId={user?._id || ''}
              />
            </motion.div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            className="text-center py-8 text-gray-400"
          >
            <p className="text-sm font-medium">No tasks yet</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-3 border-orange-200 border-t-orange-600 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Sidebar Toggle Button */}
      <motion.button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-6 left-6 z-50 p-2 rounded-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </motion.button>

      {/* Main Content */}
      <div className="flex gap-6 p-6 pt-20 max-w-7xl mx-auto">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="hidden lg:flex flex-col gap-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 h-fit"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                  🎯 Quick Stats
                </p>
                <div className="space-y-3">
                  <StatCard label="Total Tasks" value={stats.total} color="orange" />
                  <StatCard label="Completed" value={stats.completed} color="green" />
                  <StatCard label="In Progress" value={stats.inProgress} color="blue" />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                  ⌨️ Shortcuts
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">New Task</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 rounded">
                      ⌘N
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Search</span>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 rounded">
                      ⌘K
                    </kbd>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Grid */}
        <div className="flex-1 min-h-screen">
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-gray-950 dark:text-white mb-2">
              Dashboard
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
              Welcome back, <span className="font-bold text-orange-600">{user?.username}</span>
            </p>
          </motion.div>

          {/* Search & Action Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3 mb-12"
          >
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tasks... ⌘K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all font-medium"
              />
              <svg className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <motion.button
              onClick={() => setIsModalOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-700 text-white font-bold uppercase tracking-wide shadow-lg hover:shadow-xl transition-shadow"
            >
              + New Task
            </motion.button>
          </motion.div>

          {/* Bento-Style Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* My Tasks */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50">
                {taskSection('📝 My Tasks', myTasks, myTasks.length)}
              </div>
            </motion.div>

            {/* Assigned to Me */}
            <motion.div variants={itemVariants}>
              <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50 h-full">
                {taskSection('📥 Assigned to Me', assignedToMe, assignedToMe.length)}
              </div>
            </motion.div>

            {/* Assigned to Others */}
            <motion.div variants={itemVariants}>
              <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50 h-full">
                {taskSection('📤 Assigned to Others', assignedToOthers, assignedToOthers.length)}
              </div>
            </motion.div>

            {/* Team Members */}
            {allUsers.length > 0 && (
              <motion.div variants={itemVariants} className="lg:col-span-2">
                <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">
                      👥 Team Members
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => alert('Add member functionality coming soon!')}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold text-sm hover:shadow-md transition-shadow"
                    >
                      + Add Member
                    </motion.button>
                  </div>
                  <motion.div
                    className="flex gap-4 overflow-x-auto pb-2 flex-nowrap scrollbar-hide"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {allUsers.map((member) => {
                      // Count tasks assigned to this member
                      const assignedCount = [...myTasks, ...assignedToOthers].filter(
                        t => t.assignee._id === member._id
                      ).length;

                      return (
                        <motion.div
                          key={member._id}
                          variants={itemVariants}
                          whileHover={{ scale: 1.05, y: -4 }}
                          className="flex-shrink-0 w-40 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handleOpenAssignModal(member)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <p className="font-bold text-gray-900 dark:text-white truncate flex-1">
                              {member.username}
                            </p>
                            <span className="flex-shrink-0 ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold">
                              {assignedCount}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {assignedCount === 1 ? 'task assigned' : 'tasks assigned'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Click to assign new task</p>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CreateTaskModal
          onCreateTask={handleCreateTask}
          onClose={() => {
            setIsModalOpen(false);
            setAssignee(null);
          }}
          assignee={assignee}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{ label: string; value: number; color: 'orange' | 'green' | 'blue' }> = ({
  label,
  value,
  color
}) => {
  const colorClasses = {
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`rounded-xl p-4 ${colorClasses[color]}`}
    >
      <p className="text-xs font-bold uppercase tracking-widest opacity-75">{label}</p>
      <p className="text-2xl font-black mt-2">{value}</p>
    </motion.div>
  );
};

export default DashboardRefactored;
