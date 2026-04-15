// Task type definitions
export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'normal' | 'important' | 'urgent';
  creator: User;
  assignee: User;
  isPersonal?: boolean;
  projectId?: {
    _id: string;
    name: string;
    color?: string;
  };
  dueDate?: Date;
  createdAt?: Date;
  completedAt?: string;
  tags?: string[];
}

// User type definitions
export interface User {
  _id: string;
  username: string;
  email?: string;
  role: 'user' | 'admin' | 'server_admin';
  avatar?: string;
  createdAt?: Date;
}

// Project type definitions
export interface Project {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  owner: User;
  members: User[];
  tasks?: Task[];
  createdAt?: Date;
  updatedAt?: Date;
}

// API Response type
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// Pagination type
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Component Props interfaces

export interface TaskItemProps {
  task: Task;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  isCreator?: boolean;
  userRole?: string;
  userId?: string;
}

export interface TaskListProps {
  tasks: Task[];
  title: string;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  userId?: string;
  userRole?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export interface DashboardStats {
  total: number;
  completed: number;
  inProgress: number;
  urgent: number;
  important: number;
  normal: number;
}

export interface CreateTaskFormData {
  title: string;
  description?: string;
  priority: 'normal' | 'important' | 'urgent';
  assigneeId?: string;
  dueDate?: Date;
  isPersonal: boolean;
  projectId?: string;
}

export interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (users: User[]) => void;
  multiSelect?: boolean;
  selectedUsers?: User[];
  excludeUsers?: string[];
}
