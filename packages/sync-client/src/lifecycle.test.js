import assert from 'node:assert/strict';
import { SYNC_STATUS, getSyncStatus, createSyncLifecycle } from './lifecycle.js';

assert.equal(getSyncStatus(), SYNC_STATUS.IDLE);

const lifecycle = createSyncLifecycle({
  connect: async () => {},
});
assert.ok(lifecycle.getStatus);
lifecycle.dispose();
