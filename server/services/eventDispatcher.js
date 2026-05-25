const EventEmitter = require('events');

class GamificationEventEmitter extends EventEmitter {}

const eventDispatcher = new GamificationEventEmitter();

module.exports = eventDispatcher;
