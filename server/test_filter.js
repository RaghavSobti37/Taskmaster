require('dotenv').config();
const mongoose = require('mongoose');
const Log = require('./models/Log');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    
    const filter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    const logs = await Log.find(filter).lean();
    console.log(`Found ${logs.length} logs in the last 7 days`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
