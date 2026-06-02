const mongoose = require('mongoose');
const { DEFAULT_XP } = require('../../shared/gamificationRules');

const gamificationConfigSchema = new mongoose.Schema(
  {
    taskCompletion: { type: Number, default: DEFAULT_XP.taskCompletion },
    taskCreation: { type: Number, default: DEFAULT_XP.taskCreation },
    projectCreation: { type: Number, default: DEFAULT_XP.projectCreation },
    dailyLog: { type: Number, default: DEFAULT_XP.dailyLog },
    attendanceLog: { type: Number, default: DEFAULT_XP.attendanceLog },
    attendanceDayBonus: { type: Number, default: DEFAULT_XP.attendanceDayBonus },
    assetUpload: { type: Number, default: DEFAULT_XP.assetUpload },
    leadCapture: { type: Number, default: DEFAULT_XP.leadCapture },
    invoiceSubmission: { type: Number, default: DEFAULT_XP.invoiceSubmission },
    reviewApproval: { type: Number, default: DEFAULT_XP.reviewApproval },
    calendarEventCreated: { type: Number, default: DEFAULT_XP.calendarEventCreated },
    announcementCreated: { type: Number, default: DEFAULT_XP.announcementCreated },
    leaveApplied: { type: Number, default: DEFAULT_XP.leaveApplied },
    /** @deprecated use calendarEventCreated / announcementCreated */
    commentCreation: { type: Number, default: 0 },

    dailyMissionBaseReward: { type: Number, default: DEFAULT_XP.dailyMissionBaseReward },
    stepXp: { type: Number, default: DEFAULT_XP.stepXp },
    baseXp: { type: Number, default: DEFAULT_XP.baseXp },

    updatedAt: { type: Date, default: Date.now },
    /** Last global XP recalc (audit sync + user totals). */
    lastRecalculatedAt: { type: Date },
    /** Per-user weekly XP (stored amounts) captured immediately before last recalc. */
    lastRecalcWeeklyPrior: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

gamificationConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GamificationConfig', gamificationConfigSchema);
