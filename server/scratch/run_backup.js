const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const backupsDir = path.join(__dirname, '../../backups');

async function runBackup() {
  try {
    await mongoose.connect(dbUri);
    console.log('Database connected successfully for automated backup.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const currentBackupDir = path.join(backupsDir, `backup_${timestamp}`);

    if (!fs.existsSync(currentBackupDir)) {
      fs.mkdirSync(currentBackupDir, { recursive: true });
    }

    console.log(`Backing up ${collections.length} collections...`);
    for (const col of collections) {
      const data = await db.collection(col.name).find({}).toArray();
      const filePath = path.join(currentBackupDir, `${col.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    console.log(`Backup completed successfully at: ${currentBackupDir}`);

    // Rolling Retention: Keep only the 2 most recent backup directories
    const items = fs.readdirSync(backupsDir);
    const backupFolders = items
      .map(name => {
        const fullPath = path.join(backupsDir, name);
        return { name, path: fullPath, stat: fs.statSync(fullPath) };
      })
      .filter(item => {
        return item.stat.isDirectory() && 
          (item.name.startsWith('backup_') || item.name.startsWith('pre_optimization_'));
      })
      .map(item => ({
        path: item.path,
        mtime: item.stat.mtime
      }));

    // Sort by modification time descending (newest first)
    backupFolders.sort((a, b) => b.mtime - a.mtime);

    // Keep only the top 2 backups
    if (backupFolders.length > 2) {
      const foldersToRemove = backupFolders.slice(2);
      console.log(`Found ${backupFolders.length} backups. Retaining top 2. Purging ${foldersToRemove.length} stale backups...`);
      for (const folder of foldersToRemove) {
        console.log(`Purging stale backup: ${folder.path}`);
        fs.rmSync(folder.path, { recursive: true, force: true });
      }
    }

    console.log('Automated backup task complete.');
    process.exit(0);
  } catch (err) {
    console.error('Automated backup task failed:', err);
    process.exit(1);
  }
}

runBackup();
