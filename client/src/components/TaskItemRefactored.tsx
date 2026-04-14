import React from 'react';
import { motion } from 'framer-motion';

interface TaskItemRefactoredProps {
  task: {
    _id: string;
    title: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    creator: { _id: string; username: string };
    assignee: { _id: string; username: string };
    projectId?: { _id: string; name: string; color?: string };
    completedAt?: string;
  };
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  isCreator?: boolean;
  userRole?: string;
  userId?: string;
}

const TaskItemRefactored: React.FC<TaskItemRefactoredProps> = ({
  task,
  onToggleComplete,
  onDelete,
  isCreator = false,
  userRole = 'user',
  userId
}) => {
  const isCompleted = task.status === 'done';
  const isInProgress = task.status === 'in_progress';

  const priorityConfig = {
    low: { label: '🔵 Low', color: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-700 dark:text-blue-300' },
    medium: { label: '🟡 Medium', color: 'from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-800/20 text-yellow-700 dark:text-yellow-300' },
    high: { label: '🔴 High', color: 'from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 text-red-700 dark:text-red-300' }
  };

  const statusConfig = {
    todo: { label: 'To Do', icon: '📋' },
    in_progress: { label: 'In Progress', icon: '⚙️' },
    done: { label: 'Done', icon: '✅' }
  };

  const projectColor = task.projectId?.color || '#b74b02';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
      className={`group relative rounded-xl border transition-all duration-300 ${
        isCompleted
          ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 border-gray-200 dark:border-gray-700'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="p-4 flex items-start gap-4">
        {/* Checkbox */}
        <motion.button
          onClick={() => onToggleComplete(task._id)}
          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-gradient-to-br from-green-400 to-green-500 border-green-500 shadow-md'
              : 'border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-400'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isCompleted && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </motion.svg>
          )}
        </motion.button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <motion.h4
                className={`text-sm font-black tracking-tight transition-all ${
                  isCompleted
                    ? 'text-gray-400 dark:text-gray-600 line-through'
                    : 'text-gray-950 dark:text-white'
                }`}
              >
                {task.title}
              </motion.h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                By <span className="font-bold">{task.creator.username}</span>
              </p>
            </div>

            {/* Delete Button */}
            <motion.button
              onClick={() => onDelete(task._id)}
              className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </div>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Badge */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r ${priorityConfig[task.priority].color}`}
            >
              {priorityConfig[task.priority].label}
            </motion.div>

            {/* Status Badge */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r ${
                isCompleted
                  ? 'from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 text-green-700 dark:text-green-300'
                  : isInProgress
                  ? 'from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 text-purple-700 dark:text-purple-300'
                  : 'from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {statusConfig[task.status].icon} {statusConfig[task.status].label}
            </motion.div>

            {/* Project Tag */}
            {task.projectId && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold text-white"
                style={{
                  backgroundColor: projectColor,
                  boxShadow: `0 2px 8px ${projectColor}40`
                }}
              >
                {task.projectId.name}
              </motion.div>
            )}

            {/* Assignee */}
            {task.assignee && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center ml-auto px-2.5 py-1 rounded-md text-xs font-bold bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 text-orange-700 dark:text-orange-300"
              >
                👤 {task.assignee.username}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphism Accent Line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.2 }}
        className="h-1 w-full rounded-b-xl"
        style={{
          background: isCompleted
            ? 'linear-gradient(90deg, rgba(34,197,94,0.3) 0%, transparent 100%)'
            : isInProgress
            ? 'linear-gradient(90deg, rgba(168,85,247,0.3) 0%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(249,115,22,0.3) 0%, transparent 100%)'
        }}
      />
    </motion.div>
  );
};

export default TaskItemRefactored;
