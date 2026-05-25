const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function backupAllData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const modelsDir = path.join(__dirname, '../models');
    const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const backupDir = path.join(__dirname, '../../backups', `full_backup_${timestamp}`);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`Starting backup of ${files.length} collections...`);
    
    for (const file of files) {
      try {
        const modelName = file.replace('.js', '');
        const Model = require(path.join(modelsDir, file));
        
        if (Model && Model.modelName) {
          console.log(`Exporting ${Model.modelName}...`);
          const data = await Model.find({}).lean();
          fs.writeFileSync(
            path.join(backupDir, `${Model.modelName}.json`), 
            JSON.stringify(data, null, 2)
          );
          console.log(`- Saved ${data.length} records.`);
        }
      } catch (err) {
        console.warn(`Skipping ${file}: ${err.message}`);
      }
    }

    console.log(`\nBackup completed successfully at ${backupDir}`);
    process.exit(0);
  } catch (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  }
}

backupAllData();
