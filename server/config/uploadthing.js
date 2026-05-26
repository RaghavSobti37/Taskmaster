const { createUploadthing } = require('uploadthing/express');

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
  financeDocUploader: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 10 },
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    text: { maxFileSize: "16MB", maxFileCount: 10 },
    blob: { maxFileSize: "32MB", maxFileCount: 10 },
  })
    .middleware(async ({ req }) => {
      const authHeader = req?.headers?.authorization ? String(req.headers.authorization) : null;
      if (!authHeader) throw new Error("Unauthorized");
      return { userId: "authenticated-user" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Finance doc uploaded:", file.url);
      return { url: file.url, key: file.key, name: file.name, size: file.size };
    }),
};

module.exports = { uploadRouter };
