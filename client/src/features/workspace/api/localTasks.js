import { localRun } from '@coreknot/local-database';

function newLocalId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function upsertLocalTask({ id, tenantId, projectId, title, status = 'todo' }) {
  const taskId = id || newLocalId();
  const now = new Date().toISOString();
  await localRun(
    `INSERT INTO tasks (id, tenant_id, project_id, title, status, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       sync_status = 'pending',
       updated_at = excluded.updated_at`,
    [taskId, tenantId, projectId, title, status, now],
  );
  return { id: taskId, title, status, syncStatus: 'pending', updatedAt: now };
}

export async function deleteLocalTask(taskId) {
  await localRun('DELETE FROM tasks WHERE id = ?', [taskId]);
}
