const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
console.log('Connecting to database:', dbUri.replace(/\/\/.*:.*@/, '//****:****@'));

async function backupAll() {
  try {
    await mongoose.connect(dbUri);
    console.log('Database connected successfully.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const backupDir = path.join(__dirname, '../../backups', `pre_optimization_${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`Starting backup of ${collections.length} collections into: ${backupDir}`);

    for (const col of collections) {
      const name = col.name;
      console.log(`Backing up collection: ${name}`);
      const data = await db.collection(name).find({}).toArray();
      const filePath = path.join(backupDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Saved ${data.length} documents from ${name} to ${filePath}`);
    }

    console.log('Backup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  }
}

backupAll();
