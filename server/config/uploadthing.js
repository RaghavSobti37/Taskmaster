const { createUploadthing } = require('uploadthing/express');

const f = createUploadthing();

const uploadRouter = {
  imageUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 5 } })
    .middleware(async ({ req, res }) => {
      const authHeader = req.headers.authorization;
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
      return { userId: "authenticated-user" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Document uploaded:", file.url);
      return { url: file.url };
    }),
};

module.exports = { uploadRouter };
