const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\Users\\ragha\\OneDrive\\Desktop\\Taskmaster';

function run() {
  const backupDirs = ['2026-05-18T10_54_31', '2026-05-18T10_56_09', '2026-05-18T11_07_09', '2026-05-19T15_42_00'];
  for (const dir of backupDirs) {
    const csvPath = path.join(projectRoot, 'backups', dir, 'leads.csv');
    if (fs.existsSync(csvPath)) {
      const fileContent = fs.readFileSync(csvPath, 'utf8');
      const lines = fileContent.trim().split('\n');
      const header = lines[0];
      console.log(`\nBackup: ${dir}`);
      console.log(`Header: ${header}`);
      console.log(`Line count: ${lines.length}`);
      
      // Let's sample a couple of lines
      console.log(`Sample Row 1: ${lines[1]}`);
      console.log(`Sample Row 2: ${lines[2]}`);
    }
  }
}

run();
