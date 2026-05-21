require('dotenv').config();
const mongoose = require('mongoose');
const Log = require('./models/Log');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const totalLogs = await Log.countDocuments();
    const recentLogs = await Log.find().sort({_id: -1}).limit(5);
    console.log(`Total Logs: ${totalLogs}`);
    console.log('Recent logs:', JSON.stringify(recentLogs, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
