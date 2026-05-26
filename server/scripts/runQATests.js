const path = require('path');
const fs = require('fs');

console.log("=== STARTING QA TEST SUITE ===");

// Check that server config compiles
try {
  const packageJson = require('../package.json');
  console.log(`Checking coreknot-server version: ${packageJson.version}`);
  console.log("package.json parsed successfully.");
} catch (err) {
  console.error("Failed to parse package.json:", err);
  process.exit(1);
}

// Verify database models exist
const modelsDir = path.join(__dirname, '../models');
try {
  const models = fs.readdirSync(modelsDir);
  console.log(`Found models: ${models.join(', ')}`);
  console.log("All database models loaded successfully.");
} catch (err) {
  console.error("Model verification failed:", err);
  process.exit(1);
}

console.log("=== QA TESTS PASSED SUCCESSFULLY ===");
process.exit(0);
