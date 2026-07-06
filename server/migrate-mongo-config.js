// migrate-mongo v12 config (CommonJS)
const url = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || 'mongodb://127.0.0.1:27017/taskmaster_local';
const dbMatch = url.match(/\/([^/?]+)(\?|$)/);
const databaseName = dbMatch?.[1] || 'taskmaster_local';

module.exports = {
  mongodb: {
    url,
    databaseName,
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'migrations',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
