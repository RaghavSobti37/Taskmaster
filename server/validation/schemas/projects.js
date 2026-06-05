const { z } = require('zod');
const { isSafePrimitive } = require('./safeValues');

const isSafeMemberEntry = (value) => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && (value.userId === undefined || typeof value.userId === 'string')
  && (value.role === undefined || typeof value.role === 'string')
  && (value.user === undefined || typeof value.user === 'string')
);

const isSafeDefaultMember = (value) => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && (value.user === undefined || typeof value.user === 'string')
  && (value.role === undefined || typeof value.role === 'string')
);

const projectBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'members') {
      return Array.isArray(value) && value.every(isSafeMemberEntry);
    }
    if (key === 'tags' || key === 'linkedCalendars' || key === 'phases') {
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
    }
    if (key === 'starred' || key === 'archived' || key === 'isTemplate') {
      return typeof value === 'boolean' || value === undefined;
    }
    if (key === '__v' || key === 'progress') {
      return typeof value === 'number' || value === undefined;
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const createWorkspaceBody = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

const reorderWorkspacesBody = z.object({
  order: z.array(z.string()),
});

const workspaceUpdateBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'defaultMembers') {
      return Array.isArray(value) && value.every(isSafeDefaultMember);
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const addMemberBody = z.object({
  userId: z.string().min(1),
  role: z.string().optional(),
});

const updateMemberRoleBody = z.object({
  role: z.string().min(1),
});

const removeMemberBody = z.object({
  userId: z.string().min(1),
});

const linkCalendarBody = z.object({
  calendarId: z.string().min(1),
});

module.exports = {
  projectBody,
  createWorkspaceBody,
  reorderWorkspacesBody,
  workspaceUpdateBody,
  addMemberBody,
  updateMemberRoleBody,
  removeMemberBody,
  linkCalendarBody,
};
