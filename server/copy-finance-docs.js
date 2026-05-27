const mongoose = require('mongoose');
require('dotenv').config();

const financeDocumentSchema = new mongoose.Schema({}, { strict: false });

async function run() {
  const sourceUri = process.env.MONGODB_URI; 
  const targetUri = sourceUri.replace('test_backup_2026-05-26_07-18-15', 'coreknot');

  let srcConn, tgtConn;
  try {
    console.log('Connect source:', sourceUri.split('@')[1]);
    srcConn = await mongoose.createConnection(sourceUri).asPromise();
    
    console.log('Connect target:', targetUri.split('@')[1]);
    tgtConn = await mongoose.createConnection(targetUri).asPromise();

    const SrcDoc = srcConn.model('FinanceDocument', financeDocumentSchema, 'financedocuments');
    const TgtDoc = tgtConn.model('FinanceDocument', financeDocumentSchema, 'financedocuments');

    const docs = await SrcDoc.find({}).lean();
    console.log(`Found ${docs.length} docs in source.`);
    
    if (!docs.length) {
      console.log('No docs to copy.');
      return;
    }

    const ops = docs.map(d => ({
      updateOne: { filter: { _id: d._id }, update: { $set: d }, upsert: true }
    }));

    const res = await TgtDoc.bulkWrite(ops);
    console.log(`Success. Insert/Upsert: ${res.upsertedCount}, Match: ${res.matchedCount}`);
  } catch (err) {
    console.error('Fail:', err);
  } finally {
    if (srcConn) await srcConn.close();
    if (tgtConn) await tgtConn.close();
    process.exit(0);
  }
}

run();
