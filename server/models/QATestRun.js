const mongoose = require('mongoose');

const qaTestRunSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false,
    index: true
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'error', 'cancelled'],
    default: 'pending',
    index: true
  },
  startedAt: {
    type: Date,
    default: () => new Date()
  },
  completedAt: {
    type: Date,
    default: null
  },
  pagesTestedCount: {
    type: Number,
    default: 0
  },
  bugsIdentified: {
    type: Number,
    default: 0
  },
  bugsCreated: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  progress: {
    current: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currentPage: {
      type: String,
      default: 'Initializing'
    },
    totalPages: {
      type: Number,
      default: 0
    }
  },
  testIdentity: {
    name: {
      type: String,
      default: 'QA Agent'
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'guest'],
      default: 'user'
    },
    permissions: [String]
  },
  testCases: [{
    name: String,
    category: {
      type: String,
      enum: ['frontend', 'backend', 'permission', 'data', 'bottleneck', 'mobile', 'desktop'],
      default: 'backend'
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'passed', 'failed'],
      default: 'pending'
    },
    severity: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    description: String,
    duration: Number,
    result: mongoose.Schema.Types.Mixed,
    error: String,
    resolved: { type: Boolean, default: false }
  }],
  createdArtifacts: [{
    type: {
      type: String,
      enum: ['task', 'project', 'user', 'log']
    },
    id: mongoose.Schema.Types.ObjectId,
    createdAt: {
      type: Date,
      default: () => new Date()
    }
  }],
  cleanupResults: {
    deleted: {
      tasks: { type: Number, default: 0 },
      projects: { type: Number, default: 0 },
      logs: { type: Number, default: 0 }
    },
    errors: [String]
  },
  errorDetails: {
    phase: String,
    message: String,
    stack: String
  }
}, {
  timestamps: true,
  collection: 'qaTestRuns'
});

// Indexes for efficient querying
qaTestRunSchema.index({ status: 1 });
qaTestRunSchema.index({ startedAt: -1 });
qaTestRunSchema.index({ initiatedBy: 1, createdAt: -1 });

module.exports = mongoose.model('QATestRun', qaTestRunSchema);
