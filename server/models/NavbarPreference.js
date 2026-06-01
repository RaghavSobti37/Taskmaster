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

// Default navbar groups
const DEFAULT_NAVBAR_GROUPS = [
  {
    id: 'platform',
    title: 'Platform',
    order: 1,
    visible: true,
    isCustom: false,
    pages: [
      { path: '/dashboard', label: 'Dashboard', order: 1, visible: true },
      { path: '/calendar', label: 'Calendar', order: 2, visible: true },
      { path: '/todo', label: 'To-Do', order: 3, visible: true },
      { path: '/inbox', label: 'Inbox', order: 4, visible: true }
    ]
  },
  {
    id: 'workspace',
    title: 'Workspace',
    order: 2,
    visible: true,
    isCustom: false,
    pages: [
      { path: '/projects', label: 'Projects', order: 1, visible: true },
      { path: '/assets', label: 'Assets', order: 2, visible: true },
      { path: '/schedule', label: 'Schedule', order: 3, visible: true },
      { path: '/logs', label: 'Daily Logs', order: 4, visible: true },
      { path: '/emails', label: 'Emails', order: 5, visible: true }
    ]
  },
  {
    id: 'office',
    title: 'Office',
    order: 3,
    visible: true,
    isCustom: false,
    pages: [
      { path: '/equipment', label: 'Equipment', order: 1, visible: true },
      { path: '/contacts', label: 'Contacts', order: 2, visible: true },
      { path: '/attendance', label: 'Attendance', order: 3, visible: true },
      { path: '/subscriptions', label: 'Subscriptions', order: 4, visible: true }
    ]
  },
  {
    id: 'crm',
    title: 'CRM',
    order: 4,
    visible: true,
    isCustom: false,
    pages: [
      { path: '/leads', label: 'Leads', order: 1, visible: true },
      { path: '/followups', label: 'Followups', order: 2, visible: true },
      { path: '/bookings', label: 'Bookings', order: 3, visible: true }
    ]
  },
  {
    id: 'management',
    title: 'Management',
    order: 5,
    visible: true,
    isCustom: false,
    pages: [
      { path: '/finance', label: 'Finance', order: 1, visible: true },
      { path: '/announcements', label: 'Announcements', order: 2, visible: true },
      { path: '/ops-logs', label: 'Ops Logs', order: 3, visible: true },
      { path: '/artists', label: 'Artists', order: 4, visible: true }
    ]
  },
  {
    id: 'admin',
    title: 'Admin',
    order: 6,
    visible: true,
    isCustom: false,
    pages: [
      { path: '/admin/users', label: 'Users & Teams', order: 1, visible: true },
      { path: '/admin', label: 'Data Hub', order: 2, visible: true },
      { path: '/admin/exly-campaigns', label: 'Exly Data', order: 3, visible: true },
      { path: '/admin/scripts', label: 'Script Runner', order: 4, visible: true },
      { path: '/admin/gamification', label: 'Gamification', order: 5, visible: true }
    ]
  }
];

module.exports = mongoose.model('NavbarPreference', navbarPreferenceSchema);
module.exports.DEFAULT_NAVBAR_GROUPS = DEFAULT_NAVBAR_GROUPS;
