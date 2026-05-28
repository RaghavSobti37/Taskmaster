const mongoose = require('mongoose');

const gamificationConfigSchema = new mongoose.Schema(
  {
    // Action XP values
    taskCompletion: { type: Number, default: 10, description: 'XP for completing a task' },
    taskCreation: { type: Number, default: 5, description: 'XP for creating a task' },
    projectCreation: { type: Number, default: 20, description: 'XP for creating a project' },
    attendanceLog: { type: Number, default: 15, description: 'XP for logging attendance' },
    assetUpload: { type: Number, default: 25, description: 'XP for uploading an asset' },
    commentCreation: { type: Number, default: 3, description: 'XP for creating a comment' },
    leadCapture: { type: Number, default: 30, description: 'XP for capturing a lead' },
    invoiceSubmission: { type: Number, default: 35, description: 'XP for submitting an invoice' },
    
    // Daily Mission Rewards
    dailyMissionBaseReward: { type: Number, default: 50, description: 'Base reward for daily missions' },
    
    // Level progression
    stepXp: { type: Number, default: 100, description: 'XP required per level' },
    baseXp: { type: Number, default: 100, description: 'Base XP for level 1' },

    // Updated at
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

gamificationConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GamificationConfig', gamificationConfigSchema);
