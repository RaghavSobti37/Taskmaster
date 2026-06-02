const { UTApi, UTFile } = require('uploadthing/server');

let utApiKey;
try {
  const tokenData = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN || '', 'base64').toString());
  utApiKey = tokenData.apiKey;
} catch {
  utApiKey = process.env.UPLOADTHING_SECRET;
}

const utapi = new UTApi({ apiKey: utApiKey });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadOneFileToUT = async (file, maxAttempts = 3) => {
  let lastError = 'Upload failed';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const utFile = new UTFile([file.buffer], file.originalname, { type: file.mimetype });
      const uploadResult = await utapi.uploadFiles([utFile]);

      if (uploadResult[0]?.data) {
        const { url, key, name } = uploadResult[0].data;
        return {
          url: url || uploadResult[0].data.ufsUrl,
          key,
          name: name || file.originalname,
          size: file.size,
          type: file.mimetype,
        };
      }
      lastError = uploadResult[0]?.error?.message || lastError;
    } catch (err) {
      lastError = err.message || lastError;
    }
    if (attempt < maxAttempts) await sleep(1500 * attempt);
  }
  throw new Error(lastError);
};

const uploadSingleMulterFile = async (file) => {
  if (!file) throw new Error('No file provided');
  return uploadOneFileToUT(file);
};

const uploadManyMulterFiles = async (files = []) => {
  const data = [];
  const failed = [];

  for (const file of files) {
    try {
      const result = await uploadOneFileToUT(file);
      data.push(result);
    } catch (err) {
      failed.push({ fileName: file.originalname, error: err.message });
    }
    await sleep(300);
  }

  return { data, failed };
};

const handleUploadFilesManyRequest = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    const { data, failed } = await uploadManyMulterFiles(files);
    const message = failed.length
      ? `${data.length} uploaded, ${failed.length} failed`
      : `${data.length} file(s) uploaded`;

    res.status(failed.length && data.length === 0 ? 500 : 200).json({
      success: data.length > 0,
      data,
      failed,
      message,
    });
  } catch (error) {
    console.error('Multi file upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};

const handleUploadSingleRequest = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }
    const result = await uploadSingleMulterFile(req.file);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};

module.exports = {
  utapi,
  uploadOneFileToUT,
  uploadSingleMulterFile,
  uploadManyMulterFiles,
  handleUploadFilesManyRequest,
  handleUploadSingleRequest,
};
