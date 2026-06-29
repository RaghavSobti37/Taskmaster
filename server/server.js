require('dotenv').config();

const { loadConfig } = require('./config');
loadConfig();

const { createApp } = require('./app/createApp');
const { registerRoutes } = require('./app/registerRoutes');
const { startServer } = require('./app/startServer');

const app = createApp();
registerRoutes(app);
startServer(app);

module.exports = app;
