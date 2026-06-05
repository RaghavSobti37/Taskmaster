const mongoose = require('mongoose');

const navbarPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  groups: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    isCustom: { type: Boolean, default: false },
    pages: [{
      path: { type: String, required: true },
      label: { type: String, required: true },
      order: { type: Number, required: true },
      visible: { type: Boolean, default: true }
    }]
  }],
  updatedAt: {
    type: Date,
    default: () => new Date()
  }
}, {
  collection: 'navbarPreferences'
});

navbarPreferenceSchema.index({ userId: 1 });

// Default navbar groups — 3-zone usage-driven IA
const DEFAULT_NAVBAR_GROUPS = [
  {
    id: 'primary',
    title: 'Primary',
    order: 1,
    visible: true,
    isCustom: false,
    flat: true,
    pages: [
      { path: '/dashboard', label: 'Dashboard', order: 1, visible: true },
      { path: '/projects', label: 'Projects', order: 2, visible: true },
      { path: '/todo', label: 'Todo', order: 3, visible: true },
      { path: '/inbox', label: 'Inbox', order: 4, visible: true },
      { path: '/attendance', label: 'Attendance', order: 5, visible: true },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    order: 2,
    visible: true,
    isCustom: false,
    defaultOpen: true,
    pages: [
      { path: '/calendar', label: 'Calendar', order: 1, visible: true },
      { path: '/logs', label: 'Daily Logs', order: 2, visible: true },
      { path: '/notes', label: 'Notes', order: 3, visible: true },
      { path: '/assets', label: 'Assets', order: 4, visible: true },
      { path: '/schedule', label: 'Schedule', order: 5, visible: true },
      { path: '/emails', label: 'Emails', order: 6, visible: true },
    ],
  },
  {
    id: 'hubs',
    title: 'Modules',
    order: 3,
    visible: true,
    isCustom: false,
    defaultOpen: false,
    pages: [
      { path: '/crm', label: 'CRM', order: 1, visible: true },
      { path: '/office', label: 'People & Office', order: 2, visible: true },
      { path: '/management', label: 'Management', order: 3, visible: true },
      { path: '/admin/console', label: 'Admin', order: 4, visible: true },
    ],
  },
];

module.exports = mongoose.model('NavbarPreference', navbarPreferenceSchema);
module.exports.DEFAULT_NAVBAR_GROUPS = DEFAULT_NAVBAR_GROUPS;
