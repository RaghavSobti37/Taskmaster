require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const collection = mongoose.connection.db.collection('logs');
  
  // Find all string userIds that are not valid ObjectIds
  const logs = await collection.find({ userId: { $type: 'string' } }).toArray();
  let deletedCount = 0;
  
  for (const log of logs) {
    if (!mongoose.Types.ObjectId.isValid(log.userId)) {
      await collection.deleteOne({ _id: log._id });
      deletedCount++;
    } else {
      // Cast valid strings to ObjectIds
      await collection.updateOne(
        { _id: log._id },
        { $set: { userId: new mongoose.Types.ObjectId(log.userId) } }
      );
    }
  }
  
  console.log('Deleted invalid UUID logs:', deletedCount);
  process.exit(0);
});
