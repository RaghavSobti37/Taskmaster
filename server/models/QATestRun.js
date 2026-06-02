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
    },
    liveActivity: {
      phase: { type: String, default: 'idle' },
      kind: String,
      action: String,
      checklistId: String,
      testName: String,
      category: String,
      method: String,
      url: String,
      requestBody: String,
      target: String,
      httpStatus: Number,
      outcome: String,
      message: String,
      startedAt: Date,
      updatedAt: Date,
      elapsedMs: Number,
    },
  },
  activityLog: [{
    at: { type: Date, default: Date.now },
    phase: String,
    testName: String,
    checklistId: String,
    kind: String,
    summary: String,
    method: String,
    url: String,
    requestBody: String,
    httpStatus: Number,
    outcome: String,
    durationMs: Number,
    message: String,
  }],
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
      enum: [
        'frontend', 'backend', 'permission', 'data', 'bottleneck', 'mobile', 'desktop',
        'authorization', 'password-reset', 'input-validation', 'cors', 'rate-limiting',
        'error-handling', 'database-indexes', 'logging-monitoring', 'rollback', 'business-logic',
        'security-hardening',
      ],
      default: 'backend'
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'passed', 'failed', 'warn', 'skip'],
      default: 'pending'
    },
    checklistId: String,
    checkStatus: { type: String, enum: ['pass', 'fail', 'warn', 'skip'] },
    evidence: String,
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
      enum: ['task', 'project', 'user', 'log', 'finance', 'lead', 'contact']
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
