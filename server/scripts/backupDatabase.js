const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function backupAndSwitch() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to cluster.');

    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const sourceDbName = 'test'; // Assuming default 'test' is original
    const targetDbName = `test_backup_${dateStr}`;
    
    console.log(`Cloning database [${sourceDbName}] to [${targetDbName}]...`);

    const sourceDb = client.db(sourceDbName);
    const targetDb = client.db(targetDbName);

    const collections = await sourceDb.listCollections().toArray();

    for (let colInfo of collections) {
      if (colInfo.type !== 'collection') continue;
      const colName = colInfo.name;
      console.log(`Copying collection: ${colName}`);
      
      const docs = await sourceDb.collection(colName).find({}).toArray();
      if (docs.length > 0) {
        await targetDb.collection(colName).insertMany(docs);
      }
    }

    console.log('Data cloned successfully.');

    // Check if we should switch the .env (disabled for automated cron jobs)
    if (process.argv.includes('--no-switch')) {
      console.log('Automated backup finished. Skipping .env modification.');
      return;
    }

    // Update .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract base URI (remove db name if present before ?)
    const uriParts = uri.split('?');
    const baseUri = uriParts[0].endsWith('/') ? uriParts[0].slice(0, -1) : uriParts[0];
    
    // The current URI might be mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/ or mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/
    // We will replace it with mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/
    const hasDbName = baseUri.split('.net/')[1];
    const baseDomain = hasDbName !== undefined ? baseUri.substring(0, baseUri.lastIndexOf('/')) : baseUri;
    const newUri = `${baseDomain}/${targetDbName}?${uriParts[1]}`;

    envContent = envContent.replace(uri, newUri);
    fs.writeFileSync(envPath, envContent);

    console.log(`Updated MONGODB_URI in .env to use ${targetDbName}.`);
    console.log('Please restart your local server to apply changes.');
    
  } catch (err) {
    console.error('Backup error:', err);
  } finally {
    await client.close();
  }
}

backupAndSwitch();
