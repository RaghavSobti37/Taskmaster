const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed, assuming it's run from server dir so just '.env' is fine

async function main() {
    require('dotenv').config();
    const prodUri = process.env.MONGODB_URI_PROD;
    const localUri = process.env.MONGODB_URI;

    if (!prodUri || !localUri) {
        console.error("Missing MONGODB_URI or MONGODB_URI_PROD in .env");
        process.exit(1);
    }

    const prodClient = new MongoClient(prodUri);
    const localClient = new MongoClient(localUri);

    try {
        await prodClient.connect();
        await localClient.connect();
        console.log('Connected DBs.');

        const prodDb = prodClient.db('coreknot_production');
        const localDb = localClient.db('coreknot_local');

        // Initial copy
        console.log('Start initial clone Prod -> Local...');
        const collections = await prodDb.listCollections().toArray();
        
        for (let colInfo of collections) {
            const colName = colInfo.name;
            if (colName.startsWith('system.')) continue;
            
            console.log(`Copy: ${colName}`);
            const docs = await prodDb.collection(colName).find({}).toArray();
            
            if (docs.length > 0) {
                await localDb.collection(colName).deleteMany({});
                await localDb.collection(colName).insertMany(docs);
            }
        }
        console.log('Initial clone done.');

        // Live sync link (Change Streams)
        console.log('Start live sync Prod -> Local. Prod changes come to Local. Local changes stay Local.');
        const changeStream = prodDb.watch();
        
        changeStream.on('change', async (change) => {
            const colName = change.ns.coll;
            if (colName.startsWith('system.')) return;

            const localCol = localDb.collection(colName);
            
            try {
                if (change.operationType === 'insert') {
                    await localCol.insertOne(change.fullDocument);
                    console.log(`[SYNC] Insert -> ${colName}`);
                } else if (change.operationType === 'update') {
                    const updateDoc = {};
                    if (change.updateDescription.updatedFields && Object.keys(change.updateDescription.updatedFields).length > 0) {
                        updateDoc.$set = change.updateDescription.updatedFields;
                    }
                    if (change.updateDescription.removedFields && change.updateDescription.removedFields.length > 0) {
                        updateDoc.$unset = {};
                        change.updateDescription.removedFields.forEach(f => updateDoc.$unset[f] = "");
                    }
                    if (Object.keys(updateDoc).length > 0) {
                        await localCol.updateOne({ _id: change.documentKey._id }, updateDoc);
                        console.log(`[SYNC] Update -> ${colName}`);
                    }
                } else if (change.operationType === 'replace') {
                    await localCol.replaceOne({ _id: change.documentKey._id }, change.fullDocument);
                    console.log(`[SYNC] Replace -> ${colName}`);
                } else if (change.operationType === 'delete') {
                    await localCol.deleteOne({ _id: change.documentKey._id });
                    console.log(`[SYNC] Delete -> ${colName}`);
                }
            } catch (err) {
                console.error(`[SYNC ERROR]`, err);
            }
        });

        console.log('Link active. Press Ctrl+C stop.');
        
        // Keep alive
        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err);
    } finally {
        // Will only reach here on error
        await prodClient.close();
        await localClient.close();
    }
}

main().catch(console.error);
