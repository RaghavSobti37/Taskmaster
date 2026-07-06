const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(50);

function emitOnboardingEvent(event, payload = {}) {
  bus.emit(event, payload);
}

function onOnboardingEvent(event, handler) {
  bus.on(event, handler);
}

module.exports = {
  emitOnboardingEvent,
  onOnboardingEvent,
};
