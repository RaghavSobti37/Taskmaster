/** Pilot workspace sync tables — mirrors PowerSync publication subset. */
export const PILOT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  title TEXT NOT NULL,
  status TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT,
  sync_status TEXT DEFAULT 'synced',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS form_drafts (
  form_id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  last_modified_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
`;

export const PILOT_TABLES = ['workspaces', 'projects', 'tasks', 'form_drafts'];
