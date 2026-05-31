const mongoose = require('mongoose');

const dashboardPresetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    default: 'My Dashboard'
  },
  elements: [{
    componentId: {
      type: String,
      enum: [
        'leaderboard', 'announcements', 'pinboard', 'schedule',
        'review-queue', 'todos-today', 'todos-overdue', 'projects-today', 
        'notes', 'composer', 'stats', 'mark-attendance', 'leave-alerts',
        'invoice-alerts', 'attendance-overview', 'team-activity',
        'booked-calls', 'followups-today', 'pipeline-summary',
        'campaign-metrics', 'dept-stats', 'system-health', 'artist-calendar'
      ]
    },
    size: {
      type: String,
      enum: ['1', '2', '3', '4'],
      default: '1'
    },
    col: {
      type: Number,
      default: 1,
      min: 1,
      max: 4
    },
    row: {
      type: Number,
      default: 1,
      min: 1
    },
    order: {
      type: Number,
      default: 1
    },
    visible: {
      type: Boolean,
      default: true
    }
  }],
  department: {
    type: String,
    enum: ['sales', 'development', 'hr', 'marketing', 'custom'],
    default: 'custom'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  presets: [{
    name: String,
    department: String,
    elements: [{
      componentId: String,
      size: String,
      col: Number,
      row: Number,
      order: Number,
      visible: Boolean
    }]
  }],
  createdAt: {
    type: Date,
    default: () => new Date()
  },
  updatedAt: {
    type: Date,
    default: () => new Date()
  }
}, {
  collection: 'dashboardPresets'
});

dashboardPresetSchema.index({ userId: 1, createdAt: -1 });

// Department presets (static)
const DEPARTMENT_PRESETS = {
  sales: {
    name: 'Sales Dashboard',
    department: 'sales',
    elements: [
      { componentId: 'leaderboard', size: '3', order: 1, visible: true },
      { componentId: 'announcements', size: '1', order: 2, visible: true },
      { componentId: 'schedule', size: '1', order: 3, visible: true },
      { componentId: 'todos-today', size: '1', order: 4, visible: true },
      { componentId: 'notes', size: '1', order: 5, visible: true }
    ]
  },
  development: {
    name: 'Developer Dashboard',
    department: 'development',
    elements: [
      { componentId: 'review-queue', size: '3', order: 1, visible: true },
      { componentId: 'todos-today', size: '3', order: 2, visible: true },
      { componentId: 'projects-today', size: '3', order: 3, visible: true },
      { componentId: 'stats', size: '1', order: 4, visible: true },
      { componentId: 'notes', size: '1', order: 5, visible: true }
    ]
  },
  hr: {
    name: 'HR Dashboard',
    department: 'hr',
    elements: [
      { componentId: 'announcements', size: '3', order: 1, visible: true },
      { componentId: 'schedule', size: '3', order: 2, visible: true },
      { componentId: 'todos-today', size: '1', order: 3, visible: true },
      { componentId: 'notes', size: '1', order: 4, visible: true }
    ]
  },
  marketing: {
    name: 'Marketing Dashboard',
    department: 'marketing',
    elements: [
      { componentId: 'stats', size: '3', order: 1, visible: true },
      { componentId: 'announcements', size: '1', order: 2, visible: true },
      { componentId: 'schedule', size: '1', order: 3, visible: true },
      { componentId: 'todos-today', size: '3', order: 4, visible: true },
      { componentId: 'notes', size: '1', order: 5, visible: true }
    ]
  }
};

module.exports = mongoose.model('DashboardPreset', dashboardPresetSchema);
module.exports.DEPARTMENT_PRESETS = DEPARTMENT_PRESETS;
