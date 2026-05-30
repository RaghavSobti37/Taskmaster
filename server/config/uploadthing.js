const { createUploadthing } = require('uploadthing/express');
const fs = require('fs');
const path = require('path');

const DEBUG_LOG = path.join(__dirname, '../../debug-0c5d79.log');
const agentLog = (location, message, hypothesisId, data) => {
  try {
    fs.appendFileSync(DEBUG_LOG, `${JSON.stringify({ sessionId: '0c5d79', timestamp: Date.now(), location, message, hypothesisId, data })}\n`);
  } catch (_) {}
};

const f = createUploadthing();

const uploadRouter = {
  imageUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 5 } })
    .middleware(async ({ req, res }) => {
      // SECURITY: Sanitize async context, do not pass raw req/res
      const authHeader = req?.headers?.authorization ? String(req.headers.authorization) : null;
      if (!authHeader) throw new Error("Unauthorized");
      return { userId: "authenticated-user" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File url:", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  documentUploader: f({ pdf: { maxFileSize: "32MB" }, text: { maxFileSize: "16MB" } })
    .middleware(async ({ req }) => {
      // SECURITY: Strip context
      const authHeader = req?.headers?.authorization ? String(req.headers.authorization) : null;
      return { userId: "authenticated-user" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Document uploaded:", file.url);
      return { url: file.url };
    }),

  // Finance document uploader — supports PDFs, images, spreadsheets, and text files
  // minFileCount: 0 required so mixed batches (e.g. only PDFs) don't fail other types
  financeDocUploader: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 50, minFileCount: 0 },
    image: { maxFileSize: "16MB", maxFileCount: 50, minFileCount: 0 },
    text: { maxFileSize: "16MB", maxFileCount: 50, minFileCount: 0 },
    blob: { maxFileSize: "32MB", maxFileCount: 50, minFileCount: 0 },
  })
    .middleware(async ({ req }) => {
      const authHeader = req?.headers?.authorization ? String(req.headers.authorization) : null;
      agentLog('uploadthing.js:financeDocUploader:middleware', 'middleware entered', 'H3', {
        hasAuth: Boolean(authHeader),
        hasUploadthingToken: Boolean(process.env.UPLOADTHING_TOKEN || process.env.UPLOADTHING_SECRET),
      });
      if (!authHeader) {
        agentLog('uploadthing.js:financeDocUploader:middleware', 'unauthorized - missing auth header', 'H3', {});
        throw new Error("Unauthorized");
      }
      return { userId: "authenticated-user" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      agentLog('uploadthing.js:financeDocUploader:onUploadComplete', 'upload complete callback', 'H2', {
        fileName: file?.name || null,
        hasUrl: Boolean(file?.url),
        hasKey: Boolean(file?.key),
      });
      console.log("Finance doc uploaded:", file.url);
      return { url: file.url, key: file.key, name: file.name, size: file.size };
    }),
};

module.exports = { uploadRouter };
