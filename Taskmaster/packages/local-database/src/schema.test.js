import assert from 'node:assert/strict';
import { PILOT_SCHEMA_SQL, PILOT_TABLES } from './schema.js';

assert.match(PILOT_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS tasks/);
assert.deepEqual(PILOT_TABLES, ['workspaces', 'projects', 'tasks', 'form_drafts']);
