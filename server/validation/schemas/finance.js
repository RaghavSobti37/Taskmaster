const { z } = require('zod');
const { isSafePrimitive, isSafeShallowRecord } = require('./safeValues');

const submitInvoiceBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'attachments') {
      return Array.isArray(value) && value.every((item) => isSafeShallowRecord(item));
    }
    if (key === 'metadata') {
      return isSafeShallowRecord(value);
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const createFolderBody = z.object({
  folderName: z.string().min(1),
  project: z.string().min(1),
  parentFolderId: z.string().optional(),
});

module.exports = {
  submitInvoiceBody,
  createFolderBody,
};
