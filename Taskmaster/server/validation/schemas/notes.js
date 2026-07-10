const { z } = require('zod');

const noteBody = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  color: z.string().optional(),
  projectId: z.union([z.string(), z.null()]).optional(),
  calendarEventId: z.union([z.string(), z.null()]).optional(),
  workspace: z.string().optional(),
  format: z.enum(['plain', 'html']).optional(),
  visibility: z.enum(['private', 'project', 'event']).optional(),
  shareWithTeam: z.boolean().optional(),
});

module.exports = {
  createNoteBody: noteBody,
  updateNoteBody: noteBody,
};
