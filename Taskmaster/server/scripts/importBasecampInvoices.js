const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { UTApi, UTFile } = require('uploadthing/server');
const { parseDocument } = require('../utils/documentParser');
const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const User = require('../models/User');

// Initialize UploadThing
let utApiKey;
try {
  const tokenData = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN || '', 'base64').toString());
  utApiKey = tokenData.apiKey;
} catch {
  utApiKey = process.env.UPLOADTHING_SECRET;
}
const utapi = new UTApi({ apiKey: utApiKey });

const baseDir = path.resolve(__dirname, '..', '..');

// Map extensions to MIME types
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.txt': return 'text/plain';
    case '.csv': return 'text/csv';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls': return 'application/vnd.ms-excel';
    default: return 'application/octet-stream';
  }
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Database.');

  // Get or Create admin user for upload attribution
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.findOne({});
  }
  if (!adminUser) {
    console.error('No users found in database. Please run seed script first.');
    process.exit(1);
  }
  console.log(`Using User "${adminUser.name}" (${adminUser._id}) for document attribution.`);

  const tenantId = adminUser.tenantId || new mongoose.Types.ObjectId("6a14c0d1d2ce3fb936553e35");

  // Load Projects
  const projects = await Project.find({}).lean();
  
  // Scan all Basecamp Download folders
  const dirs = fs.readdirSync(baseDir).filter(name => name.startsWith('Basecamp Download'));
  console.log(`Found Basecamp folders: ${dirs.join(', ')}`);

  const allFiles = [];

  function collectFiles(dirPath, parentFolderName) {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        collectFiles(fullPath, item.name);
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          allFiles.push({
            name: item.name,
            path: fullPath,
            parentFolder: parentFolderName,
            size: fs.statSync(fullPath).size
          });
        }
      }
    }
  }

  for (const d of dirs) {
    collectFiles(path.join(baseDir, d), d);
  }

  console.log(`Collected ${allFiles.length} files to import.`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of allFiles) {
    try {
      console.log(`\nProcessing file: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);

      // 1. De-duplication check: Check if file already exists in DB
      const existingDoc = await FinanceDocument.findOne({
        fileName: file.name,
        fileSize: file.size
      });

      if (existingDoc) {
        console.log(`Document "${file.name}" with size ${file.size} already exists. Skipping.`);
        skippedCount++;
        continue;
      }

      // 2. Determine Project
      let targetProjectName = 'General Administration';
      const folderLower = file.parentFolder.toLowerCase();
      const fileLower = file.name.toLowerCase();

      if (folderLower.includes('academy') || fileLower.includes('academy')) {
        targetProjectName = 'TSC Academy';
      } else if (folderLower.includes('havells') || folderLower.includes('myousic') || fileLower.includes('havells')) {
        targetProjectName = 'Havells mYOUsic';
      } else if (folderLower.includes('himalayan') || folderLower.includes('harmonies')) {
        targetProjectName = 'Himalayan Harmonies';
      } else if (folderLower.includes('dattadham')) {
        targetProjectName = 'Dattadham';
      } else if (fileLower.includes('yugm')) {
        targetProjectName = 'Yugm';
      }

      let project = await Project.findOne({ name: { $regex: new RegExp(`^${targetProjectName}$`, 'i') } });
      if (!project) {
        console.log(`Project "${targetProjectName}" not found. Creating...`);
        project = new Project({
          name: targetProjectName,
          description: `Imported project for ${targetProjectName}`,
          outletId: 'main',
          owner: adminUser._id,
          members: [adminUser._id],
          status: 'active',
          tenantId
        });
        await project.save();
        console.log(`Project "${targetProjectName}" created with ID: ${project._id}`);
      }

      // 3. Parse file locally for text extraction and OCR (run parser first!)
      console.log('Running document OCR/Parser locally...');
      const buffer = fs.readFileSync(file.path);
      const mimeType = getMimeType(file.name);
      let parsed = { extractedText: '', metadata: {} };
      try {
        parsed = await parseDocument(buffer, mimeType);
        console.log(`OCR complete. Vendor: "${parsed.metadata.vendor || 'Unknown'}", Amount: ${parsed.metadata.amount || 0}`);
      } catch (err) {
        console.error('Parser failed, continuing with empty metadata:', err);
      }

      // 4. Upload file to UploadThing
      console.log('Uploading file to UploadThing...');
      const utFile = new UTFile([buffer], file.name, { type: mimeType });
      const uploadResult = await utapi.uploadFiles([utFile]);

      if (!uploadResult[0]?.data) {
        throw new Error(uploadResult[0]?.error?.message || 'UploadThing upload failed');
      }

      const { url, key } = uploadResult[0].data;
      console.log(`Uploaded successfully. URL: ${url}`);

      // 5. Create Database record
      const doc = new FinanceDocument({
        title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, ' ').trim(), // Clean filename for title
        description: `Imported from Basecamp: ${file.parentFolder}`,
        project: project._id,
        category: parsed.metadata.detectedCategory || 'other',
        fileUrl: url,
        fileKey: key,
        fileName: file.name,
        fileSize: file.size,
        fileType: mimeType,
        uploadedBy: adminUser._id,
        extractedText: parsed.extractedText,
        metadata: {
          amount: parsed.metadata.amount || 0,
          currency: parsed.metadata.currency || 'INR',
          vendor: parsed.metadata.vendor || '',
          date: parsed.metadata.date || null,
          tax: parsed.metadata.tax || 0,
          detectedCategory: parsed.metadata.detectedCategory || 'other'
        },
        tenantId
      });

      await doc.save();
      console.log(`Document saved to database successfully.`);
      successCount++;
    } catch (err) {
      console.error(`Error importing "${file.name}":`, err.message);
      errorCount++;
    }
  }

  console.log(`\n=== IMPORT SUMMARY ===`);
  console.log(`Successfully Imported: ${successCount}`);
  console.log(`Skipped (Duplicates):  ${skippedCount}`);
  console.log(`Errors:                 ${errorCount}`);

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

run().catch(console.error);
