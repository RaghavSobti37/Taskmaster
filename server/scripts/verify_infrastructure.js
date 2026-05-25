require('dotenv').config();
const mongoose = require('mongoose');

console.log('--- STARTING INFRASTRUCTURE VERIFICATION ---');

// 1. Check Environment Variables
console.log('\n[1] Environment Variables Found:');
const requiredKeys = ['MONGODB_URI', 'MONGO_URI', 'PORT'];
Object.keys(process.env).forEach(key => {
  if (requiredKeys.includes(key) || key.includes('KEY') || key.includes('SECRET')) {
    console.log(` - ${key}: [PRESENT]`);
  }
});

// 2. Check Database Connection
console.log('\n[2] Testing Database Connection...');
const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/coreknot';
mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ SUCCESS: Database connected successfully.');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ ERROR: Database connection failed.');
    console.error(`Details: ${err.message}`);
    process.exit(1);
  });
